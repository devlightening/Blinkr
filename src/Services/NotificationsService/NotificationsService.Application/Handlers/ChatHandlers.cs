using MediatR;
using NotificationsService.Application.Commands;
using NotificationsService.Application.DTOs;
using NotificationsService.Application.Exceptions;
using NotificationsService.Application.Mapping;
using NotificationsService.Application.Queries;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Application.Handlers;

public sealed class StartOrGetConversationHandler : IRequestHandler<StartOrGetConversationCommand, ConversationDto>
{
    private readonly IConversationRepository _conversations;
    private readonly IBlockGuard _blocks;
    public StartOrGetConversationHandler(IConversationRepository conversations, IBlockGuard blocks) { _conversations = conversations; _blocks = blocks; }

    public async Task<ConversationDto> Handle(StartOrGetConversationCommand req, CancellationToken ct)
    {
        if (req.TargetUserId == Guid.Empty)
            throw new ChatValidationException("Konuşma başlatmak için bir kullanıcı seç.");
        if (req.UserId == req.TargetUserId)
            throw new ChatValidationException("Kendinle konuşma başlatılamaz.");

        await _blocks.EnsureAllowedAsync(req.UserId, req.TargetUserId, ct);
        var conversation = await _conversations.GetOrCreateAsync(req.UserId, req.TargetUserId, ct);
        return conversation.ToDto(req.UserId);
    }
}

public sealed class SendMessageHandler : IRequestHandler<SendMessageCommand, ChatMessageDto>
{
    private readonly IConversationRepository _conversations;
    private readonly IChatMessageRepository _messages;
    private readonly IBlockGuard _blocks;

    public SendMessageHandler(IConversationRepository conversations, IChatMessageRepository messages, IBlockGuard blocks)
    {
        _conversations = conversations;
        _messages = messages;
        _blocks = blocks;
    }

    private static string? Clip(string? value, int max)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed.Length <= max ? trimmed : trimmed[..max];
    }

    public async Task<ChatMessageDto> Handle(SendMessageCommand req, CancellationToken ct)
    {
        var text = req.Text?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(text) && req.Signal is null)
            throw new ChatValidationException("Mesaj boş olamaz.");
        if (req.Signal is not null && req.Signal.PostId == Guid.Empty)
            throw new ChatValidationException("Paylaşılan sinyal seçilemedi.");
        if (text.Length > 2000)
            text = text[..2000];
        var clientId = Clip(req.ClientId, ChatRules.MaxClientIdLength);

        var conversation = await _conversations.GetByIdAsync(req.ConversationId, ct)
            ?? throw new ChatNotFoundException("Konuşma bulunamadı.");

        if (!conversation.ParticipantIds.Contains(req.UserId))
            throw new ChatForbiddenException("Bu konuşmaya erişimin yok.");
        await _blocks.EnsureAllowedAsync(req.UserId, conversation.ParticipantIds.OtherParticipant(req.UserId), ct);

        // A retried send (same client id) answers with the message that already went out.
        if (clientId is not null)
        {
            var existing = await _messages.FindByClientIdAsync(req.ConversationId, req.UserId, clientId, ct);
            if (existing is not null) return existing.ToDto(req.UserId);
        }

        var signal = req.Signal is null ? null : new SignalSharePayload
        {
            PostId = req.Signal.PostId,
            SignalType = Clip(req.Signal.SignalType, 40) ?? "GeneralObservation",
            SignalValue = Clip(req.Signal.SignalValue, 40),
            Title = Clip(req.Signal.Title, 120),
            LocationName = Clip(req.Signal.LocationName, 120),
        };
        var message = new ChatMessage
        {
            ConversationId = req.ConversationId,
            SenderId = req.UserId,
            Text = text,
            CreatedAtUtc = DateTime.UtcNow,
            ReadByUserIds = new List<Guid> { req.UserId },
            Kind = signal is null ? "text" : "signal",
            Signal = signal,
            ClientId = clientId,
        };

        var inserted = await _messages.InsertAsync(message, ct);
        var previewSource = signal is not null ? (string.IsNullOrEmpty(text) ? "Sinyal paylaştı" : text) : text;
        var preview = previewSource.Length > 120 ? previewSource[..117] + "..." : previewSource;
        await _conversations.UpdateLastMessageAsync(req.ConversationId, req.UserId, preview, inserted.CreatedAtUtc, inserted.Kind, inserted.Id, ct);

        return inserted.ToDto(req.UserId);
    }
}

public sealed class MarkConversationReadHandler : IRequestHandler<MarkConversationReadCommand, Unit>
{
    private readonly IConversationRepository _conversations;
    private readonly IChatMessageRepository _messages;

    public MarkConversationReadHandler(IConversationRepository conversations, IChatMessageRepository messages)
    {
        _conversations = conversations;
        _messages = messages;
    }

    public async Task<Unit> Handle(MarkConversationReadCommand req, CancellationToken ct)
    {
        var conversation = await _conversations.GetByIdAsync(req.ConversationId, ct)
            ?? throw new ChatNotFoundException("Konuşma bulunamadı.");

        if (!conversation.ParticipantIds.Contains(req.UserId))
            throw new ChatForbiddenException("Bu konuşmaya erişimin yok.");

        await _messages.MarkReadAsync(req.ConversationId, req.UserId, ct);
        return Unit.Value;
    }
}

public sealed class ListConversationsHandler : IRequestHandler<ListConversationsQuery, IReadOnlyList<ConversationDto>>
{
    private readonly IConversationRepository _conversations;
    private readonly IChatMessageRepository _messages;

    public ListConversationsHandler(IConversationRepository conversations, IChatMessageRepository messages)
    {
        _conversations = conversations;
        _messages = messages;
    }

    public async Task<IReadOnlyList<ConversationDto>> Handle(ListConversationsQuery q, CancellationToken ct)
    {
        var list = await _conversations.ListForUserAsync(q.UserId, ct);
        var ids = list.Select(c => c.Id).OfType<string>().ToList();
        var unread = await _messages.CountUnreadAsync(ids, q.UserId, ct);

        // A snap as the latest message needs its state (waiting / opened / expired) for the list; text does not.
        var snapIds = list.Where(c => c.LastMessageKind == "snap" && c.LastMessageId is not null).Select(c => c.LastMessageId!).ToList();
        var snaps = snapIds.Count == 0
            ? new Dictionary<string, ChatMessage>()
            : (await _messages.GetManyAsync(snapIds, ct)).Where(m => m.Id is not null).ToDictionary(m => m.Id!);
        var now = DateTime.UtcNow;

        return list.Select(c =>
        {
            string? state = c.LastMessageId is not null && snaps.TryGetValue(c.LastMessageId, out var message) && message.Snap is not null
                ? message.Snap.EffectiveState(now)
                : null;
            return c.ToDto(q.UserId, c.Id is not null ? unread.GetValueOrDefault(c.Id) : 0, state);
        }).ToList();
    }
}

public sealed class GetMessagesHandler : IRequestHandler<GetMessagesQuery, (IReadOnlyList<ChatMessageDto> Items, string? NextCursor)>
{
    private readonly IConversationRepository _conversations;
    private readonly IChatMessageRepository _messages;

    public GetMessagesHandler(IConversationRepository conversations, IChatMessageRepository messages)
    {
        _conversations = conversations;
        _messages = messages;
    }

    public async Task<(IReadOnlyList<ChatMessageDto> Items, string? NextCursor)> Handle(GetMessagesQuery q, CancellationToken ct)
    {
        var conversation = await _conversations.GetByIdAsync(q.ConversationId, ct)
            ?? throw new ChatNotFoundException("Konuşma bulunamadı.");

        if (!conversation.ParticipantIds.Contains(q.UserId))
            throw new ChatForbiddenException("Bu konuşmaya erişimin yok.");

        var limit = q.Limit is < 1 or > 100 ? 30 : q.Limit;
        var (items, next) = await _messages.ListByConversationAsync(q.ConversationId, limit, q.Before, ct);
        return (items.Select(m => m.ToDto(q.UserId)).ToList(), next);
    }
}

public sealed class UnsendMessageHandler : IRequestHandler<UnsendMessageCommand, ChatMessageDto>
{
    private readonly IConversationRepository _conversations;
    private readonly IChatMessageRepository _messages;

    public UnsendMessageHandler(IConversationRepository conversations, IChatMessageRepository messages)
    {
        _conversations = conversations;
        _messages = messages;
    }

    public async Task<ChatMessageDto> Handle(UnsendMessageCommand req, CancellationToken ct)
    {
        var conversation = await _conversations.GetByIdAsync(req.ConversationId, ct) ?? throw new ChatNotFoundException("Konuşma bulunamadı.");
        if (!conversation.ParticipantIds.Contains(req.UserId)) throw new ChatForbiddenException("Bu konuşmaya erişimin yok.");
        var message = await _messages.GetByIdAsync(req.MessageId, ct);
        if (message is null || message.ConversationId != req.ConversationId) throw new ChatNotFoundException("Mesaj bulunamadı.");
        if (message.SenderId != req.UserId) throw new ChatForbiddenException("Yalnız kendi mesajını geri alabilirsin.");
        if (message.Kind == "snap") throw new ChatValidationException("Snap geri alınamaz.");
        if (message.Kind == "unsent") return message.ToDto(req.UserId);

        message.Kind = "unsent";
        message.Text = string.Empty;
        message.Signal = null;
        message.Reactions = new();
        await _messages.ReplaceAsync(message, ct);
        if (conversation.LastMessageId == message.Id)
            await _conversations.UpdateLastMessageAsync(req.ConversationId, req.UserId, "Mesaj geri alındı", conversation.LastMessageAtUtc, "unsent", message.Id, ct);
        return message.ToDto(req.UserId);
    }
}

public sealed class ReactToMessageHandler : IRequestHandler<ReactToMessageCommand, ChatMessageDto>
{
    private readonly IConversationRepository _conversations;
    private readonly IChatMessageRepository _messages;
    private readonly IBlockGuard _blocks;

    public ReactToMessageHandler(IConversationRepository conversations, IChatMessageRepository messages, IBlockGuard blocks)
    {
        _conversations = conversations;
        _messages = messages;
        _blocks = blocks;
    }

    public async Task<ChatMessageDto> Handle(ReactToMessageCommand req, CancellationToken ct)
    {
        if (req.Emoji is not null && !ChatRules.Reactions.Contains(req.Emoji)) throw new ChatValidationException("Bu tepki kullanılamaz.");
        var conversation = await _conversations.GetByIdAsync(req.ConversationId, ct) ?? throw new ChatNotFoundException("Konuşma bulunamadı.");
        if (!conversation.ParticipantIds.Contains(req.UserId)) throw new ChatForbiddenException("Bu konuşmaya erişimin yok.");
        await _blocks.EnsureAllowedAsync(req.UserId, conversation.ParticipantIds.OtherParticipant(req.UserId), ct);
        var message = await _messages.GetByIdAsync(req.MessageId, ct);
        if (message is null || message.ConversationId != req.ConversationId) throw new ChatNotFoundException("Mesaj bulunamadı.");
        if (message.Kind == "unsent") throw new ChatValidationException("Geri alınmış mesaja tepki verilemez.");

        message.Reactions = (message.Reactions ?? new()).Where(r => r.UserId != req.UserId).ToList();
        if (req.Emoji is not null) message.Reactions.Add(new MessageReaction { UserId = req.UserId, Emoji = req.Emoji });
        await _messages.ReplaceAsync(message, ct);
        return message.ToDto(req.UserId);
    }
}
