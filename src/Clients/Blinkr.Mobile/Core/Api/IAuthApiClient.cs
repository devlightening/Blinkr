using Refit;

namespace Blinkr.Mobile.Core.Api;

/// <summary>
/// Auth API client for IdentityService login/refresh endpoints
/// </summary>
public interface IAuthApiClient
{
    [Post("/api/auth/login")]
    Task<AuthResponse> LoginAsync([Body] LoginRequest request);

    [Post("/api/auth/refresh")]
    Task<AuthResponse> RefreshTokenAsync([Body] RefreshTokenRequest request);
}

public record LoginRequest(string UserName, string Password);

public record RefreshTokenRequest(string RefreshToken);

public record AuthResponse(
    Guid UserId,
    string UserName,
    string Email,
    string Token,
    string RefreshToken,
    int ExpiresIn);

