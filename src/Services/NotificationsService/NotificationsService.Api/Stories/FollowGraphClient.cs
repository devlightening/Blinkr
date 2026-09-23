using System.Net.Http.Headers;
using System.Text.Json;

namespace NotificationsService.Api.Stories;

public sealed record FollowGraph(IReadOnlySet<Guid> Following, IReadOnlySet<Guid> Hidden);

/// <summary>
/// Follows and blocks belong to the identity service. Stories ask it "whom do I follow, whom must I not see?" with the
/// caller's own bearer token (no shared secret). Null means it could not answer: story reads then fail closed.
/// </summary>
public sealed class FollowGraphClient
{
    private readonly IHttpClientFactory _clients;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<FollowGraphClient> _logger;

    public FollowGraphClient(IHttpClientFactory clients, IHttpContextAccessor http, ILogger<FollowGraphClient> logger)
    {
        _clients = clients;
        _http = http;
        _logger = logger;
    }

    public async Task<FollowGraph?> GetAsync(CancellationToken ct)
    {
        var authorization = _http.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization)) return null;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "api/follows/graph");
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorization);
            using var response = await _clients.CreateClient(NotificationsService.Api.Services.IdentityBlockGuard.ClientName).SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Follow graph answered HTTP {Status}", (int)response.StatusCode);
                return null;
            }
            using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            HashSet<Guid> Read(string name) => doc.RootElement.TryGetProperty(name, out var array) && array.ValueKind == JsonValueKind.Array
                ? array.EnumerateArray().Select(x => Guid.TryParse(x.GetString(), out var id) ? id : Guid.Empty).Where(id => id != Guid.Empty).ToHashSet()
                : new HashSet<Guid>();
            return new FollowGraph(Read("following"), Read("hidden"));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or FormatException or InvalidOperationException)
        {
            _logger.LogWarning(ex, "Follow graph could not reach the identity service");
            return null;
        }
    }
}
