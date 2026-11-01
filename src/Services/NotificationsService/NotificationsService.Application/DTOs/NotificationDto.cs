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
    string? ActorUserName,
    /// <summary>V2-7: people in a grouped notification (1 when ungrouped) and the first two of them, newest first.</summary>
    int ActorCount = 1,
    IReadOnlyList<Guid>? ActorIds = null
);