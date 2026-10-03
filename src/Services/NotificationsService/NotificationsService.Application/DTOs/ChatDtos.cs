namespace NotificationsService.Application.DTOs;

public record ConversationDto(
    string Id,
    Guid OtherUserId,
    DateTime LastMessageAtUtc,
    string? LastMessagePreview,
    Guid? LastMessageSenderId,
    int UnreadCount = 0,
    string? LastMessageKind = null,
    string? LastMessageState = null,
    string? LastMessageId = null,
    bool IsPinned = false,
    DateTime? PinnedAtUtc = null,
    bool IsMuted = false
);

/// <summary>My own settings for one conversation after a change (doc S3/S5).</summary>
public record ConversationPreferencesDto(string ConversationId, bool IsPinned, DateTime? PinnedAtUtc, bool IsMuted);

public record ChatMessageDto(
    string Id,
    string ConversationId,
    Guid SenderId,
    string Text,
    DateTime CreatedAtUtc,
    bool IsRead,
    string Kind = "text",
    SnapDto? Snap = null,
    SignalShareDto? Signal = null,
    IReadOnlyList<ReactionDto>? Reactions = null,
    string? ClientId = null,
    ReplyDto? ReplyTo = null,
    /// <summary>Only on my own messages: the other person has read it (and when, if known).</summary>
    bool Seen = false,
    DateTime? SeenAtUtc = null,
    PlaceShareDto? Place = null
);

public record ReplyDto(string MessageId, Guid SenderId, string Text, string Kind);

public record SignalShareDto(Guid PostId, string SignalType, string? SignalValue, string? Title, string? LocationName);

/// <summary>A shared place: id plus the sender's name/category snapshot. The live state comes from PlaceService.</summary>
public record PlaceShareDto(Guid PlaceId, string Name, string? Category);
public record ReactionDto(Guid UserId, string Emoji);

/// <summary>What clients may know about a snap: never the media or its storage key.</summary>
public record SnapDto(
    string MediaType,
    int DurationSeconds,
    string? Caption,
    string State,
    DateTime ExpiresAtUtc,
    DateTime? OpenedAtUtc
);

/// <summary>Returned when a recipient opens a snap: where to fetch the media and how long they may look.</summary>
public record SnapOpenDto(
    string ContentUrl,
    string MediaType,
    int DurationSeconds,
    string? Caption,
    DateTime ViewUntilUtc
);

public record SnapContentDto(byte[] Bytes, string ContentType);
