using MongoDB.Bson.Serialization.Attributes;

namespace BlogService.Api.ReadModels;

/// <summary>
/// MongoDB document model for Post read model
/// Must match the structure created by Worker projections
/// </summary>
public class PostDocument
{
    [BsonId]
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
    public Guid Id { get; set; }

    public Guid AuthorId { get; set; }
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

    /// <summary>
    /// Computed property for comment count
    /// </summary>
    public int CommentCount => Comments?.Count ?? 0;
}

public class CommentEntity
{
    [BsonId]
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
    public Guid Id { get; set; }
    
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
}

/// <summary>
/// GeoJSON location entity for MongoDB 2dsphere index
/// </summary>
public class LocationEntity
{
    /// <summary>
    /// GeoJSON type (always "Point")
    /// </summary>
    public string Type { get; set; } = "Point";
    
    /// <summary>
    /// GeoJSON coordinates [longitude, latitude]
    /// </summary>
    public double[] Coordinates { get; set; } = new double[2];
    
    /// <summary>
    /// Optional location name from reverse geocoding
    /// </summary>
    public string? Name { get; set; }
    
    /// <summary>
    /// Timestamp when location was added/updated
    /// </summary>
    public DateTime CreatedAtUtc { get; set; }
}
