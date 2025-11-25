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
    
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAtUtc { get; set; }

    [BsonIgnore]
    public bool IsRead => ReadAtUtc.HasValue;
}