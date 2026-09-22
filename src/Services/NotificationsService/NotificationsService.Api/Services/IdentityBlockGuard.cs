using System.Net.Http.Headers;
using System.Text.Json;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Api.Services;

/// <summary>
/// Blocks belong to the identity service. This asks it "is there a block between me and them?" with the caller's own
/// bearer token, so no shared secret exists and the answer is only about the caller. If it cannot answer, chat fails
/// closed (a brief 503) instead of letting a blocked person through.
/// </summary>
public sealed class IdentityBlockGuard : IBlockGuard
{
    public const string ClientName = "identity";
    private readonly IHttpClientFactory _clients;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<IdentityBlockGuard> _logger;

    public IdentityBlockGuard(IHttpClientFactory clients, IHttpContextAccessor http, ILogger<IdentityBlockGuard> logger)
    {
        _clients = clients;
        _http = http;
        _logger = logger;
    }

    public async Task<BlockCheck> CheckAsync(Guid me, Guid other, CancellationToken ct)
    {
        if (other == Guid.Empty) return BlockCheck.Allowed;
        var authorization = _http.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization)) return BlockCheck.Unavailable;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"api/blocks/status/{other}");
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorization);
            using var response = await _clients.CreateClient(ClientName).SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Block check answered HTTP {Status}", (int)response.StatusCode);
                return BlockCheck.Unavailable;
            }
            using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            return doc.RootElement.TryGetProperty("blocked", out var blocked) && blocked.GetBoolean() ? BlockCheck.Blocked : BlockCheck.Allowed;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or FormatException or InvalidOperationException)
        {
            _logger.LogWarning(ex, "Block check could not reach the identity service");
            return BlockCheck.Unavailable;
        }
    }
}
