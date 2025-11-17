using NotificationsService.Domain.Entities;

namespace NotificationsService.Domain.Interfaces;

public interface IPushSender
{
    Task SendAsync(IEnumerable<DeviceToken> tokens, string title, string body, string? deepLink, CancellationToken ct);
}