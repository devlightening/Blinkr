using MongoDB.Bson.Serialization.Attributes;

namespace BlogService.Infrastructure.ReadModels;

/// <summary>
/// MongoDB document model for Post read model
/// Must match the structure created by Worker projections
/// </summary>
public class PostDocument
{
    [BsonId]
    [BsonGuidRepresentation(MongoDB.Bson.GuidRepresentation.Standard)]
    public Guid Id { get; set; }
    
    /// <summary>
    /// Extra elements from MongoDB (e.g., distance from $geoNear)
    /// </summary>
    [BsonExtraElements]
    public MongoDB.Bson.BsonDocument? ExtraElements { get; set; }

    public Guid AuthorId { get; set; }
    
    [BsonIgnoreIfNull]
    public string? AuthorName { get; set; }
    
    [BsonIgnoreIfNull]
    public string? AuthorGender { get; set; }
    
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }

    public int LikeCount { get; set; }
    public List<CommentEntity> Comments { get; set; } = new();
    public List<MediaEntity> Media { get; set; } = new();

    /// <summary>
    /// GeoJSON location for geospatial queries
    /// </summary>
    public LocationEntity? Location { get; set; }

    /// <summary>
    /// Location name (legacy field from Worker projections)
    /// </summary>
    public string? LocationName { get; set; }
    public Guid? PlaceId { get; set; }
    public string? SignalType { get; set; }
    public string? SignalValue { get; set; }
    public string? AudienceType { get; set; }
    public string? IdentityDisclosure { get; set; }
    public string? LocationPrecision { get; set; }
    public string? SourceType { get; set; }
    public DateTime? ExpiresAt { get; set; }

    /// <summary>
    /// Computed property for comment count
    /// </summary>
    public int CommentCount => Comments?.Count ?? 0;
}

public class CommentEntity
{
    [BsonId]
    [BsonGuidRepresentation(MongoDB.Bson.GuidRepresentation.Standard)]
    public Guid Id { get; set; }
    
    [BsonGuidRepresentation(MongoDB.Bson.GuidRepresentation.Standard)]
    public Guid AuthorId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}

public class MediaEntity
{
    [BsonId]
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
    public Guid Id { get; set; }
    
    public string Url { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public long? SizeBytes { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public double? DurationSeconds { get; set; }
    public string? ThumbnailUrl { get; set; }
}

/// <summary>
/// GeoJSON location entity for MongoDB 2dsphere index
/// </summary>
public class LocationEntity
{
    /// <summary>
    /// GeoJSON type (always "Point")
    /// </summary>
    [MongoDB.Bson.Serialization.Attributes.BsonElement("type")]
    public string Type { get; set; } = "Point";
    
    /// <summary>
    /// GeoJSON coordinates [longitude, latitude]
    /// </summary>
    [MongoDB.Bson.Serialization.Attributes.BsonElement("coordinates")]
    public double[] Coordinates { get; set; } = new double[2];
    
    /// <summary>
    /// Optional location name from reverse geocoding
    /// </summary>
    [MongoDB.Bson.Serialization.Attributes.BsonElement("name")]
    [MongoDB.Bson.Serialization.Attributes.BsonIgnoreIfNull]
    public string? Name { get; set; }
    
    /// <summary>
    /// Timestamp when location was added/updated
    /// </summary>
    [MongoDB.Bson.Serialization.Attributes.BsonElement("createdAt")]
    [MongoDB.Bson.Serialization.Attributes.BsonIgnoreIfDefault]
    public DateTime CreatedAtUtc { get; set; }
}
