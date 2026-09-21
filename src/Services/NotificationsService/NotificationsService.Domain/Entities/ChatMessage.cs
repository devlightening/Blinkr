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

    /// <summary>"text" (default, also for messages stored before snaps existed) or "snap".</summary>
    public string Kind { get; set; } = "text";

    [BsonIgnoreIfNull]
    public SnapPayload? Snap { get; set; }
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
