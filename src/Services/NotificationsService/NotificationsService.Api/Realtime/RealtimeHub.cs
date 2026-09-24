using System.Net.Http.Headers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Api.Realtime;

/// <summary>
/// V2-5 (D-028): /hubs/realtime. Every connection joins its own user group. A signal's comment room is joined only after
/// BlogService says the caller may read that signal (GET /api/posts/{id} with the caller's own token); a refused or
/// unknown signal is ignored quietly, so the hub never tells whether a hidden signal exists.
/// </summary>
[Authorize]
public sealed class RealtimeHub : Hub
{
    public const string BlogClientName = "realtime-blog";
    private readonly IHttpClientFactory _http;
    private readonly ILogger<RealtimeHub> _logger;

    public RealtimeHub(IHttpClientFactory http, ILogger<RealtimeHub> logger)
    {
        _http = http;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var user = TryUser();
        if (user == Guid.Empty) { Context.Abort(); return; }
        await Groups.AddToGroupAsync(Context.ConnectionId, RealtimeEvents.UserGroup(user));
        await base.OnConnectedAsync();
    }

    /// <summary>Joins a signal's comment room; answers whether it was allowed.</summary>
    public async Task<bool> JoinPost(string postId)
    {
        if (!Guid.TryParse(postId, out var id)) return false;
        var http = Context.GetHttpContext();
        var token = http?.Request.Query["access_token"].ToString();
        if (string.IsNullOrWhiteSpace(token))
        {
            var header = http?.Request.Headers.Authorization.ToString();
            token = header is not null && header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? header[7..] : null;
        }
        if (string.IsNullOrWhiteSpace(token)) return false;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"api/posts/{id}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var response = await _http.CreateClient(BlogClientName).SendAsync(request, Context.ConnectionAborted);
            if (!response.IsSuccessStatusCode) return false;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning("Realtime JoinPost could not ask BlogService: {Error}", ex.GetType().Name);
            return false;
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, RealtimeEvents.PostGroup(id));
        return true;
    }

    public Task LeavePost(string postId) =>
        Guid.TryParse(postId, out var id) ? Groups.RemoveFromGroupAsync(Context.ConnectionId, RealtimeEvents.PostGroup(id)) : Task.CompletedTask;

    private Guid TryUser()
    {
        try { return Context.User?.GetUserId() ?? Guid.Empty; }
        catch (InvalidOperationException) { return Guid.Empty; }
    }
}

/// <summary>SignalR delivery. A failure is logged and swallowed: realtime is a speed-up, the REST data is the truth.</summary>
public sealed class SignalRRealtimePublisher : IRealtimePublisher
{
    private readonly IHubContext<RealtimeHub> _hub;
    private readonly ILogger<SignalRRealtimePublisher> _logger;

    public SignalRRealtimePublisher(IHubContext<RealtimeHub> hub, ILogger<SignalRRealtimePublisher> logger)
    {
        _hub = hub;
        _logger = logger;
    }

    public Task ToUserAsync(Guid userId, string evt, object payload, CancellationToken ct = default) =>
        SendAsync(RealtimeEvents.UserGroup(userId), evt, payload, ct);

    public Task ToGroupAsync(string group, string evt, object payload, CancellationToken ct = default) =>
        SendAsync(group, evt, payload, ct);

    private async Task SendAsync(string group, string evt, object payload, CancellationToken ct)
    {
        try { await _hub.Clients.Group(group).SendAsync(evt, payload, ct); }
        catch (Exception ex) { _logger.LogWarning("Realtime {Event} could not be sent: {Error}", evt, ex.GetType().Name); }
    }
}
