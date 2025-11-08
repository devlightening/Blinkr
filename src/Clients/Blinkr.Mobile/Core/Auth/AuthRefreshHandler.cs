using System.Net;
using System.Net.Http.Headers;
using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Core.Auth;

/// <summary>
/// HTTP message handler with automatic token refresh on 401
/// Prevents multiple simultaneous refresh attempts using SemaphoreSlim
/// </summary>
public class AuthRefreshHandler : DelegatingHandler
{
    private readonly ITokenStore _tokenStore;
    private readonly IAuthApiClient _authApiClient;
    private static readonly SemaphoreSlim _refreshGate = new(1, 1);

    public AuthRefreshHandler(ITokenStore tokenStore, IAuthApiClient authApiClient)
    {
        _tokenStore = tokenStore;
        _authApiClient = authApiClient;
        // InnerHandler will be set automatically by HttpClient factory
        // Do NOT set it here - AddHttpMessageHandler creates the chain
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        // Add token to request
        var accessToken = await _tokenStore.GetAccessTokenAsync();
        if (!string.IsNullOrEmpty(accessToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }

        // Send request
        var response = await base.SendAsync(request, cancellationToken);

        // If 401, try to refresh token
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            // Use semaphore to prevent multiple simultaneous refresh attempts
            await _refreshGate.WaitAsync(cancellationToken);
            try
            {
                // Check if token was already refreshed by another request
                var currentToken = await _tokenStore.GetAccessTokenAsync();
                if (currentToken != accessToken)
                {
                    // Token was refreshed, retry original request with new token
                    var retryRequest = await CloneRequestAsync(request);
                    retryRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", currentToken);
                    response.Dispose();
                    return await base.SendAsync(retryRequest, cancellationToken);
                }

                // Try to refresh token
                var refreshToken = await _tokenStore.GetRefreshTokenAsync();
                if (string.IsNullOrEmpty(refreshToken))
                {
                    // No refresh token, return 401 response
                    return response;
                }

                try
                {
                    var refreshRequest = new RefreshTokenRequest(refreshToken);
                    var authResponse = await _authApiClient.RefreshTokenAsync(refreshRequest);
                    
                    // Save new tokens
                    await _tokenStore.SaveTokensAsync(authResponse.Token, authResponse.RefreshToken);

                    // Retry original request with new token
                    var retryRequest = await CloneRequestAsync(request);
                    retryRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", authResponse.Token);
                    response.Dispose();
                    return await base.SendAsync(retryRequest, cancellationToken);
                }
                catch
                {
                    // Refresh failed, return 401 response
                    return response;
                }
            }
            finally
            {
                _refreshGate.Release();
            }
        }

        return response;
    }

    private static async Task<HttpRequestMessage> CloneRequestAsync(HttpRequestMessage original)
    {
        var clone = new HttpRequestMessage(original.Method, original.RequestUri);

        // Copy headers (except Authorization, which we'll set fresh)
        foreach (var header in original.Headers)
        {
            if (header.Key != "Authorization")
            {
                clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
        }

        // Copy content if present
        if (original.Content != null)
        {
            var ms = new MemoryStream();
            await original.Content.CopyToAsync(ms);
            ms.Position = 0;
            clone.Content = new StreamContent(ms);
            
            // Copy content headers
            foreach (var header in original.Content.Headers)
            {
                clone.Content.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
        }

        return clone;
    }
}

