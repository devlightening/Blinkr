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

    /// <summary>S3: a connection holds at most this many signal rooms at once...</summary>
    public const int MaxRoomsPerConnection = 20;
    /// <summary>...and may ask to join at most this many times a minute (each ask costs a call to BlogService).</summary>
    public const int MaxJoinsPerMinute = 60;

    /// <summary>Joins a signal's comment room; answers whether it was allowed.</summary>
    public async Task<bool> JoinPost(string postId)
    {
        if (!Guid.TryParse(postId, out var id)) return false;
        var rooms = (HashSet<Guid>)(Context.Items.TryGetValue("rooms", out var r) && r is HashSet<Guid> set ? set : Context.Items["rooms"] = new HashSet<Guid>());
        if (rooms.Contains(id)) return true;
        var now = DateTime.UtcNow;
        var joins = (Queue<DateTime>)(Context.Items.TryGetValue("joins", out var j) && j is Queue<DateTime> q ? q : Context.Items["joins"] = new Queue<DateTime>());
        while (joins.Count > 0 && joins.Peek() < now.AddMinutes(-1)) joins.Dequeue();
        if (rooms.Count >= MaxRoomsPerConnection || joins.Count >= MaxJoinsPerMinute) return false;
        joins.Enqueue(now);
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
        rooms.Add(id);
        return true;
    }

    public Task LeavePost(string postId)
    {
        if (!Guid.TryParse(postId, out var id)) return Task.CompletedTask;
        if (Context.Items.TryGetValue("rooms", out var r) && r is HashSet<Guid> rooms) rooms.Remove(id);
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, RealtimeEvents.PostGroup(id));
    }

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
