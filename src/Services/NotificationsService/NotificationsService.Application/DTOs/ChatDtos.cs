namespace NotificationsService.Application.DTOs;

public record ConversationDto(
    string Id,
    Guid OtherUserId,
    DateTime LastMessageAtUtc,
    string? LastMessagePreview,
    Guid? LastMessageSenderId,
    int UnreadCount = 0
);

public record ChatMessageDto(
    string Id,
    string ConversationId,
    Guid SenderId,
    string Text,
    DateTime CreatedAtUtc,
    bool IsRead
);
