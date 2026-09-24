using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace NotificationsService.Domain.Entities;

public class ChatMessage
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.String)]
    public string ConversationId { get; set; } = default!;

    [BsonRepresentation(BsonType.String)]
    public Guid SenderId { get; set; }

    public string Text { get; set; } = default!;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    [BsonRepresentation(BsonType.String)]
    public List<Guid> ReadByUserIds { get; set; } = new();

    /// <summary>"text" (default, also for messages stored before snaps existed), "snap", "signal" or "unsent".</summary>
    public string Kind { get; set; } = "text";

    [BsonIgnoreIfNull]
    public SnapPayload? Snap { get; set; }

    /// <summary>A shared signal (Kind "signal"): a link to a post plus a display snapshot. Never an author name.</summary>
    [BsonIgnoreIfNull]
    public SignalSharePayload? Signal { get; set; }

    /// <summary>Sender-chosen id so a retried send never creates a second message (sinyal-mvp-plan P8.1).</summary>
    [BsonIgnoreIfNull]
    public string? ClientId { get; set; }

    /// <summary>One reaction per person (P8.5).</summary>
    public List<MessageReaction> Reactions { get; set; } = new();

    /// <summary>The message this one answers (plan-devam E7): a short snapshot, cleared when that message is taken back.</summary>
    [BsonIgnoreIfNull]
    public ReplyPayload? ReplyTo { get; set; }

    /// <summary>When the other person first read it (plan-devam E4, "Görüldü"). Null for older messages and snaps.</summary>
    [BsonIgnoreIfNull]
    public DateTime? ReadAtUtc { get; set; }
}

public class ReplyPayload
{
    public string MessageId { get; set; } = default!;
    [BsonRepresentation(BsonType.String)]
    public Guid SenderId { get; set; }
    /// <summary>At most 120 characters of the quoted text; empty for a snap or a taken-back message.</summary>
    public string Text { get; set; } = string.Empty;
    public string Kind { get; set; } = "text";
}

public class SignalSharePayload
{
    [BsonRepresentation(BsonType.String)]
    public Guid PostId { get; set; }
    public string SignalType { get; set; } = "GeneralObservation";
    [BsonIgnoreIfNull]
    public string? SignalValue { get; set; }
    [BsonIgnoreIfNull]
    public string? Title { get; set; }
    [BsonIgnoreIfNull]
    public string? LocationName { get; set; }
}

public class MessageReaction
{
    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }
    public string Emoji { get; set; } = string.Empty;
}

public static class ChatRules
{
    public static readonly string[] Reactions = { "❤️", "😂", "😮", "😢", "👍", "🔥" };
    public const int MaxClientIdLength = 64;
}

/// <summary>
/// A view-once photo or video sent inside a conversation. The media itself lives in private storage and is only
/// handed to the recipient after <see cref="State"/> moves from "sent" to "opened"; it is never public.
/// </summary>
public class SnapPayload
{
    public string MediaType { get; set; } = "Image";
    public string ContentType { get; set; } = "image/jpeg";

    /// <summary>Seconds the recipient may look (1-10); 0 = until they close it (used for video, which plays to its end).</summary>
    public int DurationSeconds { get; set; }

    public string? Caption { get; set; }

    /// <summary>Private storage key; null once the file has been deleted.</summary>
    [BsonIgnoreIfNull]
    public string? ObjectKey { get; set; }

    public long SizeBytes { get; set; }

    /// <summary>"sent" (waiting), "opened" or "expired".</summary>
    public string State { get; set; } = SnapStates.Sent;

    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? OpenedAtUtc { get; set; }
}

public static class SnapStates
{
    public const string Sent = "sent";
    public const string Opened = "opened";
    public const string Expired = "expired";
}
