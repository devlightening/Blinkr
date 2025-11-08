using Blinkr.Mobile.Core.Api;
using Refit;

namespace Blinkr.Mobile.Core.Auth;

public sealed class AuthService : IAuthService
{
    private readonly ITokenStore _tokenStore;
    private readonly IAuthApiClient _authApiClient;

    public AuthService(ITokenStore tokenStore, IAuthApiClient authApiClient)
    {
        _tokenStore = tokenStore;
        _authApiClient = authApiClient;
    }

    public async Task<string?> GetAccessTokenAsync()
    {
        return await _tokenStore.GetAccessTokenAsync();
    }

    public async Task<bool> IsAuthenticatedAsync()
    {
        var token = await GetAccessTokenAsync();
        return !string.IsNullOrEmpty(token);
    }

    public async Task<(bool IsSuccess, string? ErrorMessage)> RefreshTokenAsync(CancellationToken ct = default)
    {
        try
        {
            var refreshToken = await _tokenStore.GetRefreshTokenAsync();
            if (string.IsNullOrEmpty(refreshToken))
            {
                return (false, "No refresh token available");
            }

            // Call refresh endpoint
            var request = new RefreshTokenRequest(refreshToken);
            var response = await _authApiClient.RefreshTokenAsync(request);

            // Save new tokens
            await _tokenStore.SaveTokensAsync(response.Token, response.RefreshToken);

            return (true, null);
        }
        catch (ApiException apiEx)
        {
            await _tokenStore.ClearTokensAsync(); // Clear invalid tokens
            return (false, $"Refresh failed: {apiEx.StatusCode}");
        }
        catch (Exception ex)
        {
            return (false, $"Refresh error: {ex.Message}");
        }
    }

    public async Task LogoutAsync()
    {
        await _tokenStore.ClearTokensAsync();
    }
}
