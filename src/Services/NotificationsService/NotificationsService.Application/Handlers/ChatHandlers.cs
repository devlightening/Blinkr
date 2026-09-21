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
    public StartOrGetConversationHandler(IConversationRepository conversations) => _conversations = conversations;

    public async Task<ConversationDto> Handle(StartOrGetConversationCommand req, CancellationToken ct)
    {
        if (req.TargetUserId == Guid.Empty)
            throw new ChatValidationException("Konuşma başlatmak için bir kullanıcı seç.");
        if (req.UserId == req.TargetUserId)
            throw new ChatValidationException("Kendinle konuşma başlatılamaz.");

        var conversation = await _conversations.GetOrCreateAsync(req.UserId, req.TargetUserId, ct);
        return conversation.ToDto(req.UserId);
    }
}

public sealed class SendMessageHandler : IRequestHandler<SendMessageCommand, ChatMessageDto>
{
    private readonly IConversationRepository _conversations;
    private readonly IChatMessageRepository _messages;

    public SendMessageHandler(IConversationRepository conversations, IChatMessageRepository messages)
    {
        _conversations = conversations;
        _messages = messages;
    }

    public async Task<ChatMessageDto> Handle(SendMessageCommand req, CancellationToken ct)
    {
        var text = req.Text?.Trim();
        if (string.IsNullOrEmpty(text))
            throw new ChatValidationException("Mesaj boş olamaz.");
        if (text.Length > 2000)
            text = text[..2000];

        var conversation = await _conversations.GetByIdAsync(req.ConversationId, ct)
            ?? throw new ChatNotFoundException("Konuşma bulunamadı.");

        if (!conversation.ParticipantIds.Contains(req.UserId))
            throw new ChatForbiddenException("Bu konuşmaya erişimin yok.");

        var message = new ChatMessage
        {
            ConversationId = req.ConversationId,
            SenderId = req.UserId,
            Text = text,
            CreatedAtUtc = DateTime.UtcNow,
            ReadByUserIds = new List<Guid> { req.UserId },
        };

        var inserted = await _messages.InsertAsync(message, ct);
        var preview = text.Length > 120 ? text[..117] + "..." : text;
        await _conversations.UpdateLastMessageAsync(req.ConversationId, req.UserId, preview, inserted.CreatedAtUtc, "text", inserted.Id, ct);

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
