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
    public Guid UserId { get; set; }
    public NotificationType Type { get; set; }
    public NotificationContent Content { get; set; } = default!;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAtUtc { get; set; }

    [BsonIgnore]
    public bool IsRead => ReadAtUtc.HasValue;
}