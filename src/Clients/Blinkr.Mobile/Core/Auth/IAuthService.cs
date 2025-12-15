namespace Blinkr.Mobile.Core.Auth;

public interface IAuthService
{
    Task LogoutAsync();
    Task<string?> GetAccessTokenAsync();
    Task<bool> IsAuthenticatedAsync();
    Task<(bool IsSuccess, string? ErrorMessage)> RefreshTokenAsync(CancellationToken ct = default);
    Task SaveTokenAsync(string accessToken, string refreshToken);

    // Login sonrası push token kaydı için
    Task RegisterDeviceTokenAsync();
}