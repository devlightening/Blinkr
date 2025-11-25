using NotificationsService.Application.DTOs;
using NotificationsService.Domain.Entities;

namespace NotificationsService.Application.Mapping;

public static class NotificationMapper
{
    public static NotificationDto ToDto(this Notification n) =>
        new(
            n.Id ?? string.Empty,
            n.Content.Title,
            n.Content.Body,
            n.Content.DeepLink,
            n.Content.ImageUrl,
            n.Type,
            n.CreatedAtUtc,
            n.ReadAtUtc.HasValue,
            n.PostId,
            n.ActorUserId,
            n.ActorUserName
        );
}