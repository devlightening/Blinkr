using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver.GeoJsonObjectModel;

namespace PlaceService.Api.Domain;

public sealed class PlaceDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "Other";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public GeoJsonPoint<GeoJson2DGeographicCoordinates> Location { get; set; } = null!;
    public string? DisplayAddress { get; set; }
    public string Source { get; set; } = "Manual";
    [BsonIgnoreIfNull]
    public string? ExternalProvider { get; set; }
    [BsonIgnoreIfNull]
    public string? ExternalId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
    public bool IsActive { get; set; } = true;
}
