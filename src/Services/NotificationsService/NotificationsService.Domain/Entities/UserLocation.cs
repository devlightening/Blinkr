using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver.GeoJsonObjectModel;

namespace NotificationsService.Domain.Entities;

/// <summary>
/// MongoDB document for user location tracking (proximity notifications)
/// </summary>
public class UserLocation
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }
    public GeoJsonPoint<GeoJson2DGeographicCoordinates> Location { get; set; } = default!;
    public DateTime UpdatedAtUtc { get; set; }
    public DateTime? LastNotificationSentAtUtc { get; set; }
}