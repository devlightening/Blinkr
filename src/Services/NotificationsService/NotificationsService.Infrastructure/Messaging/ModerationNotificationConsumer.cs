using MassTransit;
using Microsoft.Extensions.Logging;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Enums;
using NotificationsService.Domain.Interfaces;
using Shared.Events.Events.Identity;

namespace NotificationsService.Infrastructure.Messaging;

/// <summary>
/// Tells a person about a moderation sanction (sinyal-mvp-plan 11 §4 "kullanıcıya uygulama içi bildirim"): a warning or
/// a 24 h posting limit. A suspended or closed account cannot open the app, so the notice waits for when it can.
/// </summary>
public class ModerationNotificationConsumer : IConsumer<UserSanctionedIntegrationEvent>
{
    private readonly INotificationRepository _notifications;
    private readonly ILogger<ModerationNotificationConsumer> _log;

    public ModerationNotificationConsumer(INotificationRepository notifications, ILogger<ModerationNotificationConsumer> log)
    {
        _notifications = notifications; _log = log;
    }

    public async Task Consume(ConsumeContext<UserSanctionedIntegrationEvent> context)
    {
        var m = context.Message;
        if (m.UserId == Guid.Empty) return;
        var (title, body) = m.Action switch
        {
            "warn" => ("Topluluk kuralları uyarısı", "Paylaşımların topluluk kurallarına aykırı bulundu. Tekrarlanırsa hesabın kısıtlanabilir."),
            "restrict_24h" => ("Paylaşım kısıtlandı", "Topluluk kuralları nedeniyle 24 saat boyunca sinyal, yorum ve hikâye paylaşamazsın."),
            "suspend_7d" => ("Hesap askıya alındı", "Topluluk kuralları nedeniyle hesabın 7 gün askıya alındı."),
            "ban" => ("Hesap kapatıldı", "Topluluk kurallarını ihlal ettiği için hesabın kapatıldı."),
            _ => (null, null),
        };
        if (title is null) return;
        await _notifications.InsertAsync(new Notification
        {
            UserId = m.UserId,
            Type = NotificationType.ModerationNotice,
            Content = new() { Title = title, Body = body! },
            CreatedAtUtc = m.OccurredAtUtc == default ? DateTime.UtcNow : m.OccurredAtUtc,
        }, context.CancellationToken);
        _log.LogInformation("Created moderation notice | Action={Action}", m.Action);
    }
}
