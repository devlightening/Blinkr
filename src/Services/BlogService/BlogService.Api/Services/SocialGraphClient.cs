using System.Net.Http.Headers;
using System.Text.Json;

namespace BlogService.Api.Services;

public sealed record SocialGraph(IReadOnlySet<Guid> Following, IReadOnlySet<Guid> Hidden);

/// <summary>
/// Asks IdentityService whom the caller follows and whom they must not see (blocks), with the caller's own bearer
/// token. Returns null when it cannot answer; callers decide whether to fail closed (the "Takip" feed does).
/// </summary>
public sealed class SocialGraphClient
{
    private readonly HttpClient _client;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<SocialGraphClient> _logger;

    public SocialGraphClient(HttpClient client, IHttpContextAccessor http, ILogger<SocialGraphClient> logger)
    {
        _client = client;
        _http = http;
        _logger = logger;
    }

    public async Task<SocialGraph?> GetAsync(CancellationToken ct)
    {
        var authorization = _http.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization)) return null;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "api/follows/graph");
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorization);
            using var response = await _client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Social graph answered HTTP {Status}", (int)response.StatusCode);
                return null;
            }
            using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            HashSet<Guid> Read(string name) => doc.RootElement.TryGetProperty(name, out var array) && array.ValueKind == JsonValueKind.Array
                ? array.EnumerateArray().Select(x => Guid.TryParse(x.GetString(), out var id) ? id : Guid.Empty).Where(id => id != Guid.Empty).ToHashSet()
                : new HashSet<Guid>();
            return new SocialGraph(Read("following"), Read("hidden"));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or FormatException or InvalidOperationException)
        {
            _logger.LogWarning(ex, "Social graph could not reach the identity service");
            return null;
        }
    }
}
