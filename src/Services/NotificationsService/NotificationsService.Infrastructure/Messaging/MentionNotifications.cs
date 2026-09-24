using MassTransit;
using Microsoft.Extensions.Logging;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Enums;
using NotificationsService.Domain.Interfaces;
using Shared.Events.Abstractions;
using Shared.Events.Events.Blog;

namespace NotificationsService.Infrastructure.Messaging;

/// <summary>
/// V2-4 (D-027): "X seni andı". BlogService already resolved the people (blocked ones never arrive here). The writer is
/// never notified about themselves; on an anonymous signal the notification does not say who wrote it.
/// </summary>
public static class MentionNotifications
{
    public static async Task NotifyAsync(
        INotificationRepository notifications, IDeviceTokenRepository tokens, IPushSender push,
        IEnumerable<MentionedUser>? mentions, Guid writerId, string? writerName, bool hideWriter, Guid postId, bool inComment,
        IEnumerable<Guid> alreadyTold, DateTime at, CancellationToken ct)
    {
        var skip = alreadyTold.Append(writerId).ToHashSet();
        var people = (mentions ?? Enumerable.Empty<MentionedUser>()).Select(m => m.UserId).Where(id => id != Guid.Empty && skip.Add(id)).ToList();
        if (people.Count == 0) return;

        var named = !hideWriter && !string.IsNullOrWhiteSpace(writerName);
        var body = (named, inComment) switch
        {
            (true, true) => $"{writerName} bir yorumda senden bahsetti.",
            (true, false) => $"{writerName} bir sinyalde senden bahsetti.",
            (false, true) => "Biri bir yorumda senden bahsetti.",
            (false, false) => "Biri bir sinyalde senden bahsetti.",
        };
        foreach (var userId in people)
        {
            var notification = new Notification
            {
                UserId = userId,
                Type = NotificationType.Mentioned,
                PostId = postId,
                ActorUserId = named ? writerId : null,
                ActorUserName = named ? writerName : null,
                Content = new() { Title = "Senden bahsedildi", Body = body, DeepLink = $"blinkr://posts/{postId}" },
                CreatedAtUtc = at == default ? DateTime.UtcNow : at,
            };
            await notifications.InsertAsync(notification, ct);
            var devices = await tokens.GetByUserIdsAsync(new[] { userId }, ct);
            await push.SendAsync(devices, notification.Content.Title, notification.Content.Body, notification.Content.DeepLink, ct);
        }
    }
}

/// <summary>V2-4: mentions in a new signal.</summary>
public class PostMentionNotificationConsumer : IConsumer<IPostCreatedIntegrationEvent>
{
    private readonly INotificationRepository _notifications;
    private readonly IDeviceTokenRepository _tokens;
    private readonly IPushSender _push;
    private readonly ILogger<PostMentionNotificationConsumer> _log;

    public PostMentionNotificationConsumer(INotificationRepository notifications, IDeviceTokenRepository tokens, IPushSender push, ILogger<PostMentionNotificationConsumer> log)
    {
        _notifications = notifications; _tokens = tokens; _push = push; _log = log;
    }

    public async Task Consume(ConsumeContext<IPostCreatedIntegrationEvent> context)
    {
        var m = context.Message;
        if (m.Mentions is not { Count: > 0 }) return;
        if (!string.IsNullOrWhiteSpace(m.AudienceType) && m.AudienceType != "Public") return;
        await MentionNotifications.NotifyAsync(_notifications, _tokens, _push, m.Mentions, m.AuthorId, m.AuthorName,
            m.IdentityDisclosure == "AnonymousMap", m.PostId, inComment: false, Array.Empty<Guid>(), m.OccurredOn, context.CancellationToken);
        _log.LogInformation("Mention notifications for PostId={PostId} Count={Count}", m.PostId, m.Mentions.Count);
    }
}
