using MassTransit;
using Microsoft.Extensions.Logging;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Enums;
using NotificationsService.Domain.Interfaces;
using Shared.Events.Events.Identity;

namespace NotificationsService.Infrastructure.Messaging;

/// <summary>"X seni takip etmeye başladı" / "X seni takip etmek istiyor" (sinyal-mvp-plan Faz 9 P9.5).</summary>
public class UserFollowedNotificationConsumer : IConsumer<UserFollowedIntegrationEvent>
{
    private readonly INotificationRepository _notifications;
    private readonly IDeviceTokenRepository _tokens;
    private readonly IPushSender _push;
    private readonly ILogger<UserFollowedNotificationConsumer> _log;

    public UserFollowedNotificationConsumer(INotificationRepository notifications, IDeviceTokenRepository tokens, IPushSender push, ILogger<UserFollowedNotificationConsumer> log)
    {
        _notifications = notifications; _tokens = tokens; _push = push; _log = log;
    }

    public async Task Consume(ConsumeContext<UserFollowedIntegrationEvent> context)
    {
        var m = context.Message;
        if (m.FolloweeId == Guid.Empty || m.FolloweeId == m.FollowerId) return;
        var name = string.IsNullOrWhiteSpace(m.FollowerName) ? "Biri" : m.FollowerName;
        var notification = new Notification
        {
            UserId = m.FolloweeId,
            Type = m.Requested ? NotificationType.FollowRequested : NotificationType.UserFollowed,
            ActorUserId = m.FollowerId,
            ActorUserName = string.IsNullOrWhiteSpace(m.FollowerName) ? null : m.FollowerName,
            Content = new()
            {
                Title = m.Requested ? "Takip isteği" : "Yeni takipçi",
                Body = m.Requested ? $"{name} seni takip etmek istiyor." : $"{name} seni takip etmeye başladı.",
                DeepLink = $"blinkr://users/{m.FollowerId}",
            },
            CreatedAtUtc = m.OccurredAtUtc == default ? DateTime.UtcNow : m.OccurredAtUtc,
        };
        await _notifications.InsertAsync(notification, context.CancellationToken);
        var tokens = await _tokens.GetByUserIdsAsync(new[] { m.FolloweeId }, context.CancellationToken);
        await _push.SendAsync(tokens, notification.Content.Title, notification.Content.Body, notification.Content.DeepLink, context.CancellationToken);
        _log.LogInformation("Created follow notification | Type={Type}", notification.Type);
    }
}

/// <summary>"X takip isteğini kabul etti".</summary>
public class FollowAcceptedNotificationConsumer : IConsumer<FollowRequestAcceptedIntegrationEvent>
{
    private readonly INotificationRepository _notifications;
    private readonly IDeviceTokenRepository _tokens;
    private readonly IPushSender _push;

    public FollowAcceptedNotificationConsumer(INotificationRepository notifications, IDeviceTokenRepository tokens, IPushSender push)
    {
        _notifications = notifications; _tokens = tokens; _push = push;
    }

    public async Task Consume(ConsumeContext<FollowRequestAcceptedIntegrationEvent> context)
    {
        var m = context.Message;
        if (m.FollowerId == Guid.Empty || m.FollowerId == m.AccepterId) return;
        var name = string.IsNullOrWhiteSpace(m.AccepterName) ? "Biri" : m.AccepterName;
        var notification = new Notification
        {
            UserId = m.FollowerId,
            Type = NotificationType.FollowAccepted,
            ActorUserId = m.AccepterId,
            ActorUserName = string.IsNullOrWhiteSpace(m.AccepterName) ? null : m.AccepterName,
            Content = new()
            {
                Title = "Takip isteği kabul edildi",
                Body = $"{name} takip isteğini kabul etti.",
                DeepLink = $"blinkr://users/{m.AccepterId}",
            },
            CreatedAtUtc = m.OccurredAtUtc == default ? DateTime.UtcNow : m.OccurredAtUtc,
        };
        await _notifications.InsertAsync(notification, context.CancellationToken);
        var tokens = await _tokens.GetByUserIdsAsync(new[] { m.FollowerId }, context.CancellationToken);
        await _push.SendAsync(tokens, notification.Content.Title, notification.Content.Body, notification.Content.DeepLink, context.CancellationToken);
    }
}
