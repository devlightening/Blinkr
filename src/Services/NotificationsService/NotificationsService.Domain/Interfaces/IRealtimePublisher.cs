namespace NotificationsService.Domain.Interfaces;

/// <summary>
/// V2-5 (D-028): pushes a small "something changed" event to connected apps over SignalR. Events carry ids only (never
/// message text or who can see what): the app refetches through the normal REST endpoints, which already apply every
/// privacy rule. Publishing never fails the write that caused it; a missed event is repaired by the app's slow poll.
/// </summary>
public interface IRealtimePublisher
{
    Task ToUserAsync(Guid userId, string evt, object payload, CancellationToken ct = default);
    Task ToGroupAsync(string group, string evt, object payload, CancellationToken ct = default);
}

/// <summary>Event names on the hub (API-SPEC §5).</summary>
public static class RealtimeEvents
{
    public const string MessageCreated = "message.created";
    public const string MessageUpdated = "message.updated";
    public const string MessageRead = "message.read";
    public const string Typing = "typing";
    public const string CommentAdded = "comment.added";
    public const string CommentDeleted = "comment.deleted";
    public const string CommentChanged = "comment.changed";
    public const string ReactionChanged = "reaction.changed";
    public const string NotificationCreated = "notification.created";

    public static string UserGroup(Guid userId) => $"user:{userId}";
    public static string PostGroup(Guid postId) => $"post:{postId}";
}
