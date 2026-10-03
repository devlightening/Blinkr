using MediatR;
using NotificationsService.Application.DTOs;

namespace NotificationsService.Application.Commands;

public record StartOrGetConversationCommand(Guid UserId, Guid TargetUserId) : IRequest<ConversationDto>;

public record SignalShareInput(Guid PostId, string? SignalType, string? SignalValue, string? Title, string? LocationName);

/// <summary>A catalog place to share (design doc B1): its id and the name/category the sender saw.</summary>
public record PlaceShareInput(Guid PlaceId, string? Name, string? Category);

/// <param name="ClientId">Optional idempotency key: the same key in the same conversation returns the first message.</param>
/// <param name="Signal">Optional shared signal (the text is then an optional note).</param>
/// <param name="Place">Optional shared place (the text is then an optional note); never together with a signal.</param>
public record SendMessageCommand(Guid UserId, string ConversationId, string Text, string? ClientId = null, SignalShareInput? Signal = null, string? ReplyToId = null, PlaceShareInput? Place = null) : IRequest<ChatMessageDto>;

/// <summary>"I am typing" (plan-devam E4): remembered for a few seconds, never stored.</summary>
public record TypingCommand(Guid UserId, string ConversationId) : IRequest<Unit>;

/// <summary>Takes back my own text or signal message: its content is removed for both people.</summary>
public record UnsendMessageCommand(Guid UserId, string ConversationId, string MessageId) : IRequest<ChatMessageDto>;

/// <summary>Sets (or with a null emoji clears) my reaction on a message.</summary>
public record ReactToMessageCommand(Guid UserId, string ConversationId, string MessageId, string? Emoji) : IRequest<ChatMessageDto>;

public record MarkConversationReadCommand(Guid UserId, string ConversationId) : IRequest<Unit>;

/// <summary>
/// Doc S3/S5: my own pin and mute for a conversation. A null field is left as it is, so the client can change one
/// without knowing the other. Only I see them; the other person is never told.
/// </summary>
public record UpdateConversationPreferencesCommand(Guid UserId, string ConversationId, bool? Pinned, bool? Muted) : IRequest<ConversationPreferencesDto>;

public record SendSnapCommand(Guid UserId, string ConversationId, byte[] Content, string ContentType, int DurationSeconds, string? Caption) : IRequest<ChatMessageDto>;

public record OpenSnapCommand(Guid UserId, string ConversationId, string MessageId) : IRequest<SnapOpenDto>;
