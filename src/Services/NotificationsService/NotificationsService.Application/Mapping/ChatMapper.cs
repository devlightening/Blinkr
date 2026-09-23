using NotificationsService.Application.DTOs;
using NotificationsService.Domain.Entities;

namespace NotificationsService.Application.Mapping;

public static class ChatMapper
{
    public static ConversationDto ToDto(this Conversation c, Guid viewerId, int unreadCount = 0, string? lastMessageState = null) =>
        new(
            c.Id ?? string.Empty,
            c.ParticipantIds.FirstOrDefault(p => p != viewerId),
            c.LastMessageAtUtc,
            c.LastMessagePreview,
            c.LastMessageSenderId,
            unreadCount,
            c.LastMessageKind ?? "text",
            lastMessageState,
            c.LastMessageId
        );

    /// <summary>"sent" past its expiry reads as "expired" even before the cleanup job has touched it.</summary>
    public static string EffectiveState(this SnapPayload snap, DateTime nowUtc) =>
        snap.State == SnapStates.Sent && snap.ExpiresAtUtc <= nowUtc ? SnapStates.Expired : snap.State;

    public static ChatMessageDto ToDto(this ChatMessage m, Guid viewerId) =>
        new(
            m.Id ?? string.Empty,
            m.ConversationId,
            m.SenderId,
            m.Text,
            m.CreatedAtUtc,
            m.SenderId == viewerId || m.ReadByUserIds.Contains(viewerId),
            m.Kind,
            m.Snap is null ? null : new SnapDto(m.Snap.MediaType, m.Snap.DurationSeconds, m.Snap.Caption, m.Snap.EffectiveState(DateTime.UtcNow), m.Snap.ExpiresAtUtc, m.Snap.OpenedAtUtc),
            m.Signal is null ? null : new SignalShareDto(m.Signal.PostId, m.Signal.SignalType, m.Signal.SignalValue, m.Signal.Title, m.Signal.LocationName),
            (m.Reactions ?? new()).Select(r => new ReactionDto(r.UserId, r.Emoji)).ToList(),
            m.SenderId == viewerId ? m.ClientId : null
        );
}
