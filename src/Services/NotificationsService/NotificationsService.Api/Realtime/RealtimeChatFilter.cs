using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Api.Realtime;

/// <summary>
/// V2-5 (D-028): after a chat write succeeds, tells both people in the conversation (and their other devices) that it
/// changed. Only ids travel; the apps refetch the thread through REST. Typing goes only to the other person.
/// </summary>
public sealed class RealtimeChatFilter : IAsyncActionFilter
{
    private readonly IRealtimePublisher _realtime;
    private readonly IConversationRepository _conversations;

    public RealtimeChatFilter(IRealtimePublisher realtime, IConversationRepository conversations)
    {
        _realtime = realtime;
        _conversations = conversations;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var executed = await next();
        if (executed.Exception is not null && !executed.ExceptionHandled) return;
        if (HttpMethods.IsGet(context.HttpContext.Request.Method)) return;
        var status = executed.Result switch { ObjectResult o => o.StatusCode ?? 200, StatusCodeResult s => s.StatusCode, _ => 200 };
        if (status is < 200 or >= 300) return;
        if (context.RouteData.Values["id"] is not string conversationId) return;

        var evt = (context.ActionDescriptor.RouteValues["action"] ?? string.Empty) switch
        {
            "SendMessage" or "SendSnap" => RealtimeEvents.MessageCreated,
            "Typing" => RealtimeEvents.Typing,
            "MarkRead" => RealtimeEvents.MessageRead,
            _ => RealtimeEvents.MessageUpdated,
        };
        var me = context.HttpContext.User.GetUserId();
        var conversation = await _conversations.GetByIdAsync(conversationId, context.HttpContext.RequestAborted);
        if (conversation is null || !conversation.ParticipantIds.Contains(me)) return;

        var payload = new { conversationId, userId = me };
        foreach (var participant in conversation.ParticipantIds.Distinct())
        {
            if (evt == RealtimeEvents.Typing && participant == me) continue;
            await _realtime.ToUserAsync(participant, evt, payload, CancellationToken.None);
        }
    }
}

/// <summary>V2-5: every stored notification is also pushed to its owner as "notification.created".</summary>
public sealed class RealtimeNotificationRepository : INotificationRepository
{
    private readonly INotificationRepository _inner;
    private readonly IRealtimePublisher _realtime;

    public RealtimeNotificationRepository(INotificationRepository inner, IRealtimePublisher realtime)
    {
        _inner = inner;
        _realtime = realtime;
    }

    public async Task InsertAsync(Notification n, CancellationToken ct)
    {
        await _inner.InsertAsync(n, ct);
        await _realtime.ToUserAsync(n.UserId, RealtimeEvents.NotificationCreated, new { id = n.Id, type = n.Type.ToString() }, CancellationToken.None);
    }

    public async Task<Notification?> UpsertGroupedAsync(Notification n, TimeSpan window, Func<IReadOnlyList<string>, int, string> bodyOf, CancellationToken ct)
    {
        var stored = await _inner.UpsertGroupedAsync(n, window, bodyOf, ct);
        if (stored is not null)
            await _realtime.ToUserAsync(stored.UserId, RealtimeEvents.NotificationCreated, new { id = stored.Id, type = stored.Type.ToString() }, CancellationToken.None);
        return stored;
    }

    public Task MarkReadAsync(IEnumerable<string> ids, Guid userId, CancellationToken ct) => _inner.MarkReadAsync(ids, userId, ct);
    public Task<(IReadOnlyList<Notification> Items, string? NextCursor)> ListAsync(Guid userId, int limit, string? cursor, CancellationToken ct) => _inner.ListAsync(userId, limit, cursor, ct);
    public Task<long> UnreadCountAsync(Guid userId, CancellationToken ct) => _inner.UnreadCountAsync(userId, ct);
}
