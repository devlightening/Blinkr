using NotificationsService.Domain.Entities;

namespace NotificationsService.Domain.Interfaces;

public interface INotificationRepository
{
    Task InsertAsync(Notification n, CancellationToken ct);
    /// <summary>
    /// V2-7 (D-029): adds the actor to an open group (same user + GroupKey within the window) or starts one. Answers the
    /// stored notification, or null when this actor is already in the group (nothing new to tell).
    /// </summary>
    Task<Notification?> UpsertGroupedAsync(Notification n, TimeSpan window, Func<IReadOnlyList<string>, int, string> bodyOf, CancellationToken ct);
    Task MarkReadAsync(IEnumerable<string> ids, Guid userId, CancellationToken ct);
    Task<(IReadOnlyList<Notification> Items, string? NextCursor)> ListAsync(Guid userId, int limit, string? cursor, CancellationToken ct);
    Task<long> UnreadCountAsync(Guid userId, CancellationToken ct);
}

public interface IDeviceTokenRepository
{
    Task UpsertAsync(DeviceToken token, CancellationToken ct);
    Task<IReadOnlyList<DeviceToken>> GetByUserIdsAsync(IEnumerable<Guid> userIds, CancellationToken ct);
}