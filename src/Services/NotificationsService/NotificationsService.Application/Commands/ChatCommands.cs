using MediatR;
using NotificationsService.Application.DTOs;

namespace NotificationsService.Application.Commands;

public record StartOrGetConversationCommand(Guid UserId, Guid TargetUserId) : IRequest<ConversationDto>;

public record SendMessageCommand(Guid UserId, string ConversationId, string Text) : IRequest<ChatMessageDto>;

public record MarkConversationReadCommand(Guid UserId, string ConversationId) : IRequest<Unit>;
