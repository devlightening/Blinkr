using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Net.Http.Json;
using Microsoft.Maui.Authentication;
using Microsoft.Maui.Storage;

namespace Blinkr.Mobile.Core.Auth;

public interface IAuthService
{
    Task<bool> LoginAsync(CancellationToken ct = default);
    Task LogoutAsync();
    Task<string?> GetAccessTokenAsync();
    Task<bool> IsAuthenticatedAsync();
    Task<(bool IsSuccess, string? ErrorMessage)> RefreshTokenAsync(CancellationToken ct = default);
}

public sealed class AuthService : IAuthService
{
    private readonly Env _env;
    private const string AccessTokenKey = "auth.access_token";
    private const string RefreshTokenKey = "auth.refresh_token";

    public AuthService(Env env) => _env = env;

    public async Task<bool> LoginAsync(CancellationToken ct = default)
    {
        try
        {
            // PKCE Code Challenge
            var codeVerifier = Base64Url(Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"));
            var codeChallenge = Base64Url(SHA256.HashData(Encoding.UTF8.GetBytes(codeVerifier)));
            
            var authorizeUrl = $"{_env.Authority}/connect/authorize" +
                $"?client_id={_env.ClientId}" +
                $"&redirect_uri={Uri.EscapeDataString(_env.RedirectUri)}" +
                $"&response_type=code" +
                $"&scope={Uri.EscapeDataString(_env.Scopes)}" +
                $"&code_challenge={codeChallenge}" +
                $"&code_challenge_method=S256" +
                $"&state={Guid.NewGuid():N}";

            var callbackUrl = _env.RedirectUri;

            var result = await WebAuthenticator.Default.AuthenticateAsync(
                new Uri(authorizeUrl),
                new Uri(callbackUrl));

            var code = result?.Properties?["code"];
            if (string.IsNullOrEmpty(code)) return false;

            // Token Exchange
            using var client = new HttpClient();
            var form = new Dictionary<string, string>
            {
                ["client_id"] = _env.ClientId,
                ["grant_type"] = "authorization_code",
                ["code"] = code!,
                ["redirect_uri"] = _env.RedirectUri,
                ["code_verifier"] = codeVerifier
            };

            var tokenResp = await client.PostAsync($"{_env.Authority}/connect/token", 
                new FormUrlEncodedContent(form), ct);
            
            if (!tokenResp.IsSuccessStatusCode) return false;

            var json = await tokenResp.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct);
            if (json?.access_token is null) return false;

            await SecureStorage.SetAsync(AccessTokenKey, json.access_token);
            if (!string.IsNullOrEmpty(json.refresh_token))
                await SecureStorage.SetAsync(RefreshTokenKey, json.refresh_token);

            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Login failed: {ex.Message}");
            return false;
        }
    }

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

    public async Task<bool> IsAuthenticatedAsync()
    {
        var token = await GetAccessTokenAsync();
        return !string.IsNullOrEmpty(token);
    }

    public async Task<(bool IsSuccess, string? ErrorMessage)> RefreshTokenAsync(CancellationToken ct = default)
    {
        try
        {
            var refreshToken = await SecureStorage.GetAsync(RefreshTokenKey);
            if (string.IsNullOrEmpty(refreshToken))
            {
                return (false, "No refresh token available");
            }

            using var client = new HttpClient();
            var form = new Dictionary<string, string>
            {
                ["client_id"] = _env.ClientId,
                ["grant_type"] = "refresh_token",
                ["refresh_token"] = refreshToken
            };

            var tokenResp = await client.PostAsync($"{_env.Authority}/connect/token", 
                new FormUrlEncodedContent(form), ct);
            
            if (!tokenResp.IsSuccessStatusCode)
            {
                return (false, $"Token refresh failed: {tokenResp.StatusCode}");
            }

            var json = await tokenResp.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct);
            if (json?.access_token is null)
            {
                return (false, "Invalid token response");
            }

            await SecureStorage.SetAsync(AccessTokenKey, json.access_token);
            if (!string.IsNullOrEmpty(json.refresh_token))
                await SecureStorage.SetAsync(RefreshTokenKey, json.refresh_token);

            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public Task LogoutAsync()
    {
        try
        {
            SecureStorage.Remove(AccessTokenKey);
            SecureStorage.Remove(RefreshTokenKey);
        }
        catch
        {
            // Ignore errors during logout
        }
        return Task.CompletedTask;
    }

    private static string Base64Url(byte[] input) => 
        Convert.ToBase64String(input).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    
    private static string Base64Url(string s) => 
        Base64Url(Encoding.UTF8.GetBytes(s));

    private sealed record TokenResponse(string? access_token, string? refresh_token, int expires_in);
}

public record Env(string ApiBase, string Authority, string ClientId, string RedirectUri, string Scopes)
{
    public static Env LoadFromConfig()
    {
        // For now, return dev environment
        // TODO: Load from Environments.json
        return new Env(
            ApiBase: "http://10.0.2.2:5215",
            Authority: "http://10.0.2.2:5001", 
            ClientId: "blinkr.mobile",
            RedirectUri: "blinkr://auth-callback",
            Scopes: "openid profile api.read api.write"
        );
    }
}
