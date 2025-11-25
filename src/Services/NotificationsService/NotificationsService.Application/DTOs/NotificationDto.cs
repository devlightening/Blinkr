using NotificationsService.Domain.Enums;

namespace NotificationsService.Application.DTOs;

public record NotificationDto(
    string Id,
    string Title,
    string Body,
    string? DeepLink,
    string? ImageUrl,
    NotificationType Type,
    DateTime CreatedAtUtc,
    bool IsRead,
    Guid? PostId,
    Guid? ActorUserId,
    string? ActorUserName
);