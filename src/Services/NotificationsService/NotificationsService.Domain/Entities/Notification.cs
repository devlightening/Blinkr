using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using NotificationsService.Domain.ValueObjects;
using NotificationsService.Domain.Enums;

namespace NotificationsService.Domain.Entities;

public class Notification
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }  // who receives the notification
    
    public NotificationType Type { get; set; }
    public NotificationContent Content { get; set; } = default!;
    
    // Related entity IDs
    [BsonRepresentation(BsonType.String)]
    public Guid? PostId { get; set; }  // the post being liked/commented on
    
    [BsonRepresentation(BsonType.String)]
    public Guid? ActorUserId { get; set; }  // who performed the action (liker/commenter)
    
    public string? ActorUserName { get; set; }  // display name of the actor

    /// <summary>
    /// V2-7 (D-029): reactions and story likes on the same thing within an hour share one row ("ayse, mert ve 3 kişi
    /// daha ..."). Null for notifications that are never grouped (comments, follows, mentions).
    /// </summary>
    [BsonIgnoreIfNull]
    public string? GroupKey { get; set; }

    /// <summary>V2-7: everyone in the group (so the same person twice is not counted twice).</summary>
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public List<Guid>? ActorIds { get; set; }

    /// <summary>V2-7: the latest three names, newest first.</summary>
    [BsonIgnoreIfNull]
    public List<string>? ActorNames { get; set; }

    /// <summary>V2-7: how many people are in the group (0 on older, ungrouped notifications = one person).</summary>
    [BsonIgnoreIfDefault]
    public int ActorCount { get; set; }
    
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAtUtc { get; set; }

    [BsonIgnore]
    public bool IsRead => ReadAtUtc.HasValue;
}