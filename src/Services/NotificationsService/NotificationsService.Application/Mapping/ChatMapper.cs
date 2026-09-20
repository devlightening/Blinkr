using NotificationsService.Application.DTOs;
using NotificationsService.Domain.Entities;

namespace NotificationsService.Application.Mapping;

public static class ChatMapper
{
    public static ConversationDto ToDto(this Conversation c, Guid viewerId, int unreadCount = 0) =>
        new(
            c.Id ?? string.Empty,
            c.ParticipantIds.FirstOrDefault(p => p != viewerId),
            c.LastMessageAtUtc,
            c.LastMessagePreview,
            c.LastMessageSenderId,
            unreadCount
        );

    public static ChatMessageDto ToDto(this ChatMessage m, Guid viewerId) =>
        new(
            m.Id ?? string.Empty,
            m.ConversationId,
            m.SenderId,
            m.Text,
            m.CreatedAtUtc,
            m.SenderId == viewerId || m.ReadByUserIds.Contains(viewerId)
        );
}
