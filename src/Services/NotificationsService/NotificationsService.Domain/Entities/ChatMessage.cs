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
}
