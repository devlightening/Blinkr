using Refit;
using System.Text.Json.Serialization;

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

public record LoginRequest(
    [property: JsonPropertyName("userName")] string UserName, 
    [property: JsonPropertyName("password")] string Password);

public record RefreshTokenRequest(
    [property: JsonPropertyName("refreshToken")] string RefreshToken);

public record AuthResponse(
    [property: JsonPropertyName("userId")] Guid UserId,
    [property: JsonPropertyName("userName")] string UserName,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("token")] string Token,
    [property: JsonPropertyName("refreshToken")] string RefreshToken,
    [property: JsonPropertyName("expiresIn")] int ExpiresIn);

