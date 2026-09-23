using MediatR;
using NotificationsService.Application.DTOs;

namespace NotificationsService.Application.Commands;

public record StartOrGetConversationCommand(Guid UserId, Guid TargetUserId) : IRequest<ConversationDto>;

public record SignalShareInput(Guid PostId, string? SignalType, string? SignalValue, string? Title, string? LocationName);

/// <param name="ClientId">Optional idempotency key: the same key in the same conversation returns the first message.</param>
/// <param name="Signal">Optional shared signal (the text is then an optional note).</param>
public record SendMessageCommand(Guid UserId, string ConversationId, string Text, string? ClientId = null, SignalShareInput? Signal = null) : IRequest<ChatMessageDto>;

/// <summary>Takes back my own text or signal message: its content is removed for both people.</summary>
public record UnsendMessageCommand(Guid UserId, string ConversationId, string MessageId) : IRequest<ChatMessageDto>;

/// <summary>Sets (or with a null emoji clears) my reaction on a message.</summary>
public record ReactToMessageCommand(Guid UserId, string ConversationId, string MessageId, string? Emoji) : IRequest<ChatMessageDto>;

public record MarkConversationReadCommand(Guid UserId, string ConversationId) : IRequest<Unit>;

public record SendSnapCommand(Guid UserId, string ConversationId, byte[] Content, string ContentType, int DurationSeconds, string? Caption) : IRequest<ChatMessageDto>;

public record OpenSnapCommand(Guid UserId, string ConversationId, string MessageId) : IRequest<SnapOpenDto>;
