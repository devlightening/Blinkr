using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace NotificationsService.Domain.Entities;

/// <summary>
/// One person's own settings for one conversation (design doc S3/S5): pinned to the top of their list, muted. The other
/// participant never sees them and they never change what either person can send or read. Kept apart from
/// <see cref="Conversation"/> on purpose: the conversation is shared state written on every message, these are private
/// per-person choices, so neither write path contends with or can leak the other. A row with nothing set is deleted.
/// </summary>
public class ConversationPreference
{
    /// <summary>At most this many conversations are pinned per person (Snapchat's limit; doc S3).</summary>
    public const int MaxPinned = 3;

    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }

    public string ConversationId { get; set; } = string.Empty;

    /// <summary>When it was pinned; pinned conversations are listed oldest pin first, so a new pin goes below.</summary>
    public DateTime? PinnedAtUtc { get; set; }

    public DateTime? MutedAtUtc { get; set; }

    [BsonIgnore]
    public bool IsPinned => PinnedAtUtc.HasValue;

    [BsonIgnore]
    public bool IsMuted => MutedAtUtc.HasValue;

    /// <summary>Nothing is set: the row carries no information and can be removed.</summary>
    [BsonIgnore]
    public bool IsEmpty => !IsPinned && !IsMuted;

    public static ConversationPreference For(Guid userId, string conversationId) => new() { UserId = userId, ConversationId = conversationId };

    /// <summary>Pinning again keeps the first pin time, so re-sending the same request does not reorder the list.</summary>
    public void SetPinned(bool pinned, DateTime nowUtc) => PinnedAtUtc = pinned ? PinnedAtUtc ?? nowUtc : null;

    public void SetMuted(bool muted, DateTime nowUtc) => MutedAtUtc = muted ? MutedAtUtc ?? nowUtc : null;
}
