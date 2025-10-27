using System.Net;
using System.Net.Http.Headers;
using Blinkr.Mobile.Core.Auth;
using Microsoft.Extensions.Logging;

namespace Blinkr.Mobile.Core.Http;

public class AuthRefreshHandler : DelegatingHandler
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthRefreshHandler> _logger;
    private readonly SemaphoreSlim _refreshSemaphore = new(1, 1);

    public AuthRefreshHandler(IAuthService authService, ILogger<AuthRefreshHandler> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var response = await base.SendAsync(request, cancellationToken);

        // If we get 401, try to refresh token and retry once
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            _logger.LogInformation("Received 401, attempting token refresh");
            
            await _refreshSemaphore.WaitAsync(cancellationToken);
            try
            {
                // Check if token was already refreshed by another request
                if (response.StatusCode != HttpStatusCode.Unauthorized)
                {
                    return response;
                }

                var refreshResult = await _authService.RefreshTokenAsync();
                if (refreshResult.IsSuccess)
                {
                    _logger.LogInformation("Token refreshed successfully, retrying request");
                    
                    // Update authorization header
                    var newToken = await _authService.GetAccessTokenAsync();
                    if (!string.IsNullOrEmpty(newToken))
                    {
                        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", newToken);
                        
                        // Dispose the previous response and retry
                        response.Dispose();
                        return await base.SendAsync(request, cancellationToken);
                    }
                }
                else
                {
                    _logger.LogWarning("Token refresh failed: {Error}", refreshResult.ErrorMessage);
                }
            }
            finally
            {
                _refreshSemaphore.Release();
            }
        }

        return response;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _refreshSemaphore?.Dispose();
        }
        base.Dispose(disposing);
    }
}
