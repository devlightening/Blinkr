namespace Blinkr.Mobile.Core.Auth;

/// <summary>
/// Token storage interface for HttpClient token injection
/// </summary>
public interface ITokenStore
{
    Task<string?> GetAccessTokenAsync();
    Task<string?> GetRefreshTokenAsync();
    Task SaveTokensAsync(string accessToken, string? refreshToken = null);
    Task ClearTokensAsync();
}

