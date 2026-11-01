using MediatR;
using NotificationsService.Application.Commands;
using NotificationsService.Application.DTOs;
using NotificationsService.Application.Exceptions;
using NotificationsService.Application.Mapping;
using NotificationsService.Application.Queries;
using NotificationsService.Application.Snaps;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Application.Handlers;

public sealed class SendSnapHandler : IRequestHandler<SendSnapCommand, ChatMessageDto>
{
    private readonly IConversationRepository _conversations;
    private readonly IChatMessageRepository _messages;
    private readonly ISnapStorage _storage;
    private readonly SnapSettings _settings;
    private readonly IBlockGuard _blocks;

    public SendSnapHandler(IConversationRepository conversations, IChatMessageRepository messages, ISnapStorage storage, SnapSettings settings, IBlockGuard blocks)
    {
        _conversations = conversations;
        _messages = messages;
        _storage = storage;
        _settings = settings;
        _blocks = blocks;
    }

    public async Task<ChatMessageDto> Handle(SendSnapCommand req, CancellationToken ct)
    {
        var contentType = SnapMedia.NormalizeContentType(req.ContentType);
        var isImage = SnapMedia.IsImage(contentType);
        var isVideo = SnapMedia.IsVideo(contentType);
        if (!isImage && !isVideo)
            throw new ChatValidationException("Bu dosya türü Snap olarak gönderilemez.");

        var maxBytes = isVideo ? _settings.MaxVideoBytes : _settings.MaxImageBytes;
        if (req.Content.Length == 0 || req.Content.Length > maxBytes)
            throw new ChatValidationException(isVideo ? "Video çok büyük." : "Fotoğraf çok büyük.");
        if (!SnapMedia.LooksValid(req.Content, contentType))
            throw new ChatValidationException("Dosya, bildirilen türle uyuşmuyor.");
        if (req.DurationSeconds is < 0 or > 10)
            throw new ChatValidationException("Süre 1 ile 10 saniye arasında olmalı.");

        var conversation = await _conversations.GetByIdAsync(req.ConversationId, ct)
            ?? throw new ChatNotFoundException("Konuşma bulunamadı.");
        if (!conversation.ParticipantIds.Contains(req.UserId))
            throw new ChatForbiddenException("Bu konuşmaya erişimin yok.");
        await _blocks.EnsureAllowedAsync(req.UserId, conversation.ParticipantIds.OtherParticipant(req.UserId), ct);

        // A photo without a timer would stay open forever; a video plays to its end.
        var duration = isVideo ? 0 : Math.Max(1, req.DurationSeconds);
        var caption = req.Caption?.Trim();
        if (string.IsNullOrEmpty(caption)) caption = null;
        else if (caption.Length > _settings.MaxCaptionLength) caption = caption[.._settings.MaxCaptionLength];

        var bytes = contentType == "image/jpeg" ? SnapMedia.StripJpegMetadata(req.Content) : req.Content;
        var key = $"{req.ConversationId}/{Guid.NewGuid():N}.bin";
        await _storage.SaveAsync(key, bytes, ct);

        var now = DateTime.UtcNow;
        var message = new ChatMessage
        {
            ConversationId = req.ConversationId,
            SenderId = req.UserId,
            Text = string.Empty,
            CreatedAtUtc = now,
            ReadByUserIds = new List<Guid> { req.UserId },
            Kind = "snap",
            Snap = new SnapPayload
            {
                MediaType = isVideo ? "Video" : "Image",
                ContentType = contentType,
                DurationSeconds = duration,
                Caption = caption,
                ObjectKey = key,
                SizeBytes = bytes.Length,
                State = SnapStates.Sent,
                ExpiresAtUtc = now.AddHours(_settings.ExpiresAfterHours),
            },
        };

        ChatMessage inserted;
        try
        {
            inserted = await _messages.InsertAsync(message, ct);
        }
        catch
        {
            await _storage.DeleteAsync(key, CancellationToken.None);
            throw;
        }

        await _conversations.UpdateLastMessageAsync(req.ConversationId, req.UserId, "Snap", inserted.CreatedAtUtc, "snap", inserted.Id, ct);
        return inserted.ToDto(req.UserId);
    }
}

public sealed class OpenSnapHandler : IRequestHandler<OpenSnapCommand, SnapOpenDto>
{
    private readonly IConversationRepository _conversations;
    private readonly IChatMessageRepository _messages;
    private readonly SnapSettings _settings;

    public OpenSnapHandler(IConversationRepository conversations, IChatMessageRepository messages, SnapSettings settings)
    {
        _conversations = conversations;
        _messages = messages;
        _settings = settings;
    }

    public async Task<SnapOpenDto> Handle(OpenSnapCommand req, CancellationToken ct)
    {
        var conversation = await _conversations.GetByIdAsync(req.ConversationId, ct)
            ?? throw new ChatNotFoundException("Konuşma bulunamadı.");
        if (!conversation.ParticipantIds.Contains(req.UserId))
            throw new ChatForbiddenException("Bu konuşmaya erişimin yok.");

        var now = DateTime.UtcNow;
        var opened = await _messages.TryOpenSnapAsync(req.MessageId, req.UserId, now, ct);
        if (opened?.Snap is not null && opened.ConversationId == req.ConversationId)
        {
            return new SnapOpenDto(
                $"/api/chat/snaps/{opened.Id}/content",
                opened.Snap.MediaType,
                opened.Snap.DurationSeconds,
                opened.Snap.Caption,
                now.Add(_settings.ViewWindow(opened.Snap.DurationSeconds)));
        }

        // Nothing was opened: say why, without giving away more than the person is allowed to know.
        var message = await _messages.GetByIdAsync(req.MessageId, ct);
        if (message?.Snap is null || message.ConversationId != req.ConversationId)
            throw new ChatNotFoundException("Snap bulunamadı.");
        if (message.SenderId == req.UserId)
            throw new ChatForbiddenException("Kendi Snap'ini açamazsın.");
        if (message.Snap.EffectiveState(now) == SnapStates.Expired)
            throw new ChatGoneException("SNAP_EXPIRED", "Bu Snap'in süresi doldu.");
        throw new ChatGoneException("SNAP_OPENED", "Bu Snap zaten açıldı.");
    }
}

public sealed class GetSnapContentHandler : IRequestHandler<GetSnapContentQuery, SnapContentDto>
{
    private readonly IChatMessageRepository _messages;
    private readonly IConversationRepository _conversations;
    private readonly ISnapStorage _storage;
    private readonly SnapSettings _settings;

    public GetSnapContentHandler(IChatMessageRepository messages, IConversationRepository conversations, ISnapStorage storage, SnapSettings settings)
    {
        _messages = messages;
        _conversations = conversations;
        _storage = storage;
        _settings = settings;
    }

    public async Task<SnapContentDto> Handle(GetSnapContentQuery req, CancellationToken ct)
    {
        var message = await _messages.GetByIdAsync(req.MessageId, ct);
        if (message?.Snap is null) throw new ChatNotFoundException("Snap bulunamadı.");

        var conversation = await _conversations.GetByIdAsync(message.ConversationId, ct);
        if (conversation is null || !conversation.ParticipantIds.Contains(req.UserId))
            throw new ChatForbiddenException("Bu Snap'e erişimin yok.");
        if (message.SenderId == req.UserId)
            throw new ChatForbiddenException("Kendi Snap'ini geri alamazsın.");

        var snap = message.Snap;
        var now = DateTime.UtcNow;
        // A snap nobody opened yet is not viewable, and asking for it early must not harm it.
        if (snap.State == SnapStates.Sent && snap.EffectiveState(now) == SnapStates.Sent)
            throw new ChatGoneException("SNAP_NOT_OPENED", "Bu Snap henüz açılmadı.");

        var withinWindow = snap.State == SnapStates.Opened && snap.OpenedAtUtc is { } openedAt && now <= openedAt + _settings.ViewWindow(snap.DurationSeconds);
        if (!withinWindow || snap.ObjectKey is null)
        {
            // The window is over (or it expired unopened): the file is deleted right away, not at the next cleanup pass.
            if (snap.ObjectKey is not null) { await _storage.DeleteAsync(snap.ObjectKey, ct); await _messages.MarkSnapPurgedAsync(req.MessageId, ct); }
            var expired = snap.EffectiveState(now) == SnapStates.Expired;
            throw new ChatGoneException(expired ? "SNAP_EXPIRED" : "SNAP_OPENED", expired ? "Bu Snap'in süresi doldu." : "Bu Snap artık görüntülenemez.");
        }

        var bytes = await _storage.ReadAsync(snap.ObjectKey, ct)
            ?? throw new ChatGoneException("SNAP_OPENED", "Bu Snap artık görüntülenemez.");
        return new SnapContentDto(bytes, snap.ContentType);
    }
}
