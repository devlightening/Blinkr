using System.Net.Http.Headers;
using System.Text.Json;

namespace BlogService.Api.Services;

public enum ProfileVisibility { Visible, Hidden, Unavailable }

/// <summary>
/// Follows, private accounts and blocks belong to the identity service. Before listing someone's signals on their
/// profile, this asks it "may the caller see this account?" with the caller's own bearer token (or none for a
/// signed-out caller), so no shared secret exists. If it cannot answer, the list fails closed (sinyal-mvp-plan Faz 6).
/// </summary>
public sealed class ProfileVisibilityGuard
{
    private readonly HttpClient _client;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<ProfileVisibilityGuard> _logger;

    public ProfileVisibilityGuard(HttpClient client, IHttpContextAccessor http, ILogger<ProfileVisibilityGuard> logger)
    {
        _client = client;
        _http = http;
        _logger = logger;
    }

    public async Task<ProfileVisibility> CheckAsync(Guid ownerId, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"api/follows/visibility/{ownerId}");
            var authorization = _http.HttpContext?.Request.Headers.Authorization.ToString();
            if (!string.IsNullOrWhiteSpace(authorization)) request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorization);
            using var response = await _client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Profile visibility check answered HTTP {Status}", (int)response.StatusCode);
                return ProfileVisibility.Unavailable;
            }
            using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            return doc.RootElement.TryGetProperty("canSee", out var canSee) && canSee.GetBoolean() ? ProfileVisibility.Visible : ProfileVisibility.Hidden;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or FormatException or InvalidOperationException)
        {
            _logger.LogWarning(ex, "Profile visibility check could not reach the identity service");
            return ProfileVisibility.Unavailable;
        }
    }
}
