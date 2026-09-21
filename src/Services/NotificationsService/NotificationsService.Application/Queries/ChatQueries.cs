using MediatR;
using NotificationsService.Application.DTOs;

namespace NotificationsService.Application.Queries;

public record ListConversationsQuery(Guid UserId) : IRequest<IReadOnlyList<ConversationDto>>;

public record GetSnapContentQuery(Guid UserId, string MessageId) : IRequest<SnapContentDto>;

public record GetMessagesQuery(Guid UserId, string ConversationId, int Limit = 30, string? Before = null)
    : IRequest<(IReadOnlyList<ChatMessageDto> Items, string? NextCursor)>;
