using MediatR;
using NotificationsService.Application.DTOs;

namespace NotificationsService.Application.Commands;

public record StartOrGetConversationCommand(Guid UserId, Guid TargetUserId) : IRequest<ConversationDto>;

public record SendMessageCommand(Guid UserId, string ConversationId, string Text) : IRequest<ChatMessageDto>;

public record MarkConversationReadCommand(Guid UserId, string ConversationId) : IRequest<Unit>;

public record SendSnapCommand(Guid UserId, string ConversationId, byte[] Content, string ContentType, int DurationSeconds, string? Caption) : IRequest<ChatMessageDto>;

public record OpenSnapCommand(Guid UserId, string ConversationId, string MessageId) : IRequest<SnapOpenDto>;
