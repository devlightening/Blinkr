using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace NotificationsService.Domain.Entities;

public class DeviceToken
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }
    public string Token { get; set; } = default!;
    public string Platform { get; set; } = "android"; // ios|web|android
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
