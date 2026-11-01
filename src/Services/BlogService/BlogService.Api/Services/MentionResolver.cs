using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BlogService.Domain.Events;
using Shared.Events.Text;

namespace BlogService.Api.Services;

/// <summary>What the text asked for: too many mentions is the only reason to refuse the write.</summary>
public sealed record MentionResolution(IReadOnlyList<MentionRef> Mentions, bool TooMany);

/// <summary>
/// V2-4 (D-027): turns the @names in a text into people. The server reads the names from the text itself (a client can
/// not mention someone who is not in the text) and asks IdentityService, with the writer's own token, who they are;
/// IdentityService leaves out deleted accounts and anyone blocked either way. More than
/// <see cref="TextTags.MaxMentions"/> distinct names is refused. If IdentityService cannot answer, the text is still
/// published without mentions (nobody is notified) - a mention is a courtesy, not part of the signal.
/// </summary>
public sealed class MentionResolver
{
    private readonly HttpClient _client;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<MentionResolver> _logger;

    public MentionResolver(HttpClient client, IHttpContextAccessor http, ILogger<MentionResolver> logger)
    {
        _client = client;
        _http = http;
        _logger = logger;
    }

    public async Task<MentionResolution> ResolveAsync(Guid writerId, CancellationToken ct, params string?[] texts)
    {
        var names = texts.SelectMany(TextTags.Mentions).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (names.Count == 0) return new MentionResolution(Array.Empty<MentionRef>(), false);
        if (names.Count > TextTags.MaxMentions) return new MentionResolution(Array.Empty<MentionRef>(), true);

        var authorization = _http.HttpContext?.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(authorization)) return new MentionResolution(Array.Empty<MentionRef>(), false);
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "api/users/resolve") { Content = JsonContent.Create(new { userNames = names }) };
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorization);
            using var response = await _client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Mention resolve answered HTTP {Status}", (int)response.StatusCode);
                return new MentionResolution(Array.Empty<MentionRef>(), false);
            }
            var people = await response.Content.ReadFromJsonAsync<List<ResolvedUser>>(cancellationToken: ct) ?? new();
            var mentions = people.Where(p => p.Id != Guid.Empty && p.Id != writerId && !string.IsNullOrWhiteSpace(p.UserName))
                .GroupBy(p => p.Id).Select(g => new MentionRef(g.Key, g.First().UserName)).ToList();
            return new MentionResolution(mentions, false);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or NotSupportedException or FormatException)
        {
            _logger.LogWarning(ex, "Mentions could not be resolved; publishing without them");
            return new MentionResolution(Array.Empty<MentionRef>(), false);
        }
    }

    private sealed record ResolvedUser(Guid Id, string UserName);
}
