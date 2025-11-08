using System.Net.Http.Headers;

namespace Blinkr.Mobile.Core.Auth;

/// <summary>
/// HTTP message handler that automatically adds Authorization header with access token
/// </summary>
public class AuthMessageHandler : DelegatingHandler
{
    private readonly ITokenStore _tokenStore;

    public AuthMessageHandler(ITokenStore tokenStore)
    {
        _tokenStore = tokenStore;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var token = await _tokenStore.GetAccessTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return await base.SendAsync(request, cancellationToken);
    }
}

