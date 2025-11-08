namespace Blinkr.Mobile.Core.Auth;

public interface IAuthService
{
    Task LogoutAsync();
    Task<string?> GetAccessTokenAsync();
    Task<bool> IsAuthenticatedAsync();
    Task<(bool IsSuccess, string? ErrorMessage)> RefreshTokenAsync(CancellationToken ct = default);
}
