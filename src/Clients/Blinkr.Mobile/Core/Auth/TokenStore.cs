using Microsoft.Maui.Storage;

namespace Blinkr.Mobile.Core.Auth;

public class TokenStore : ITokenStore
{
    private const string AccessTokenKey = "auth.access_token";
    private const string RefreshTokenKey = "auth.refresh_token";

    public async Task<string?> GetAccessTokenAsync()
    {
        try
        {
            return await SecureStorage.GetAsync(AccessTokenKey);
        }
        catch
        {
            return null;
        }
    }

    public async Task<string?> GetRefreshTokenAsync()
    {
        try
        {
            return await SecureStorage.GetAsync(RefreshTokenKey);
        }
        catch
        {
            return null;
        }
    }

    public async Task SaveTokensAsync(string accessToken, string? refreshToken = null)
    {
        await SecureStorage.SetAsync(AccessTokenKey, accessToken);
        if (!string.IsNullOrEmpty(refreshToken))
        {
            await SecureStorage.SetAsync(RefreshTokenKey, refreshToken);
        }
    }

    public async Task ClearTokensAsync()
    {
        try
        {
            SecureStorage.Remove(AccessTokenKey);
            SecureStorage.Remove(RefreshTokenKey);
        }
        catch
        {
            // Ignore errors
        }
        await Task.CompletedTask;
    }
}

