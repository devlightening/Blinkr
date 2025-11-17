using NotificationsService.Domain.Entities;

namespace NotificationsService.Domain.Interfaces;

public interface INotificationRepository
{
    Task InsertAsync(Notification n, CancellationToken ct);
    Task MarkReadAsync(IEnumerable<string> ids, Guid userId, CancellationToken ct);
    Task<(IReadOnlyList<Notification> Items, string? NextCursor)> ListAsync(Guid userId, int limit, string? cursor, CancellationToken ct);
    Task<long> UnreadCountAsync(Guid userId, CancellationToken ct);
}

public interface IDeviceTokenRepository
{
    Task UpsertAsync(DeviceToken token, CancellationToken ct);
    Task<IReadOnlyList<DeviceToken>> GetByUserIdsAsync(IEnumerable<Guid> userIds, CancellationToken ct);
}