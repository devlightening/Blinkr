using MassTransit;
using Microsoft.Extensions.Logging;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Enums;
using NotificationsService.Domain.Interfaces;
using Shared.Events.Events.Place;

namespace NotificationsService.Infrastructure.Messaging;

/// <summary>
/// "Haber ver" (D-038): a place's live state changed; everyone waiting for exactly that state hears about it once and
/// their watch ends. A watch is removed before its notice is written and only the caller that removed it writes, so a
/// redelivered event never notifies twice. The person whose own signal caused the change is not told about it.
/// The notice opens the verified signal that caused the change (blinkr://posts/{id}); it never names who posted it.
/// </summary>
public class PlaceWatchNotificationConsumer : IConsumer<PlaceLiveStateChangedIntegrationEvent>
{
    private readonly IPlaceWatchRepository _watches;
    private readonly INotificationRepository _notifications;
    private readonly ILogger<PlaceWatchNotificationConsumer> _log;

    public PlaceWatchNotificationConsumer(IPlaceWatchRepository watches, INotificationRepository notifications, ILogger<PlaceWatchNotificationConsumer> log)
    {
        _watches = watches;
        _notifications = notifications;
        _log = log;
    }

    public async Task Consume(ConsumeContext<PlaceLiveStateChangedIntegrationEvent> context)
    {
        var m = context.Message;
        if (m.PlaceId == Guid.Empty || m.SignalType is null) return;
        var ct = context.CancellationToken;

        var candidates = await _watches.ListForPlaceAsync(m.PlaceId, DateTime.UtcNow, ct);
        var sent = 0;
        foreach (var watch in candidates)
        {
            if (!PlaceWatch.Matches(watch.Condition, m.SignalType, m.SignalValue)) continue;
            // Their own signal caused it: they already know. The watch stays for someone else's confirmation.
            if (m.CausedByAuthorId.HasValue && m.CausedByAuthorId == watch.UserId) continue;
            if (watch.Id is null || !await _watches.TryConsumeAsync(watch.Id, ct)) continue;

            var name = string.IsNullOrWhiteSpace(m.PlaceName) ? watch.PlaceName : m.PlaceName;
            await _notifications.InsertAsync(new Notification
            {
                UserId = watch.UserId,
                Type = NotificationType.PlaceWatch,
                PostId = m.CausedByPostId,
                Content = new()
                {
                    Title = TitleFor(watch.Condition, name),
                    Body = $"{StateLabel(m.SignalType, m.SignalValue)} · konumda doğrulandı",
                    DeepLink = $"blinkr://posts/{m.CausedByPostId}",
                },
                CreatedAtUtc = DateTime.UtcNow,
            }, ct);
            sent++;
        }
        if (sent > 0) _log.LogInformation("Place watch notices | PlaceId={PlaceId} | EventId={EventId} | Sent={Sent}", m.PlaceId, m.Id, sent);
    }

    private static string TitleFor(string condition, string place) => condition switch
    {
        PlaceWatch.Calm => $"{place} sakinleşti",
        PlaceWatch.Open => $"{place} açık",
        _ => $"{place}: yeni durum",
    };

    /// <summary>The same words the app uses for the signal catalog (Doluluk, Bekleme, Geçici durum).</summary>
    private static string StateLabel(string? type, string? value) => (type, value?.Trim().ToUpperInvariant()) switch
    {
        ("Crowd", "CALM" or "EMPTY") => "Doluluk: Sakin",
        ("Crowd", "MODERATE") => "Doluluk: Hareketli",
        ("Crowd", "BUSY") => "Doluluk: Kalabalık",
        ("Queue", "NONE") => "Bekleme: Sıra yok",
        ("Queue", "5TO15") => "Bekleme: 5–15 dk",
        ("Queue", "OVER15" or "LONG") => "Bekleme: 15 dk üzeri",
        ("TemporaryStatus", "OPEN") => "Durum: Açık",
        ("TemporaryStatus", "CLOSED") => "Durum: Kapalı",
        _ => "Yeni bilgi",
    };
}
