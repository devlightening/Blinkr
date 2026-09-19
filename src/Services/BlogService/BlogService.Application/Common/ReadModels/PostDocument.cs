using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver.GeoJsonObjectModel;

namespace BlogService.Application.Common.ReadModels;

/// <summary>
/// Read-only view of the "posts" Mongo collection, mirroring the schema
/// Blinkr.Projections.Worker writes. Intentionally duplicated rather than
/// referenced across the service boundary - BlogService.Application must not
/// take a compile-time dependency on a separate deployable microservice.
/// </summary>
public class PostDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; }

    [BsonRepresentation(BsonType.String)]
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
    public List<PostCommentReadModel> Comments { get; set; } = new();

    [BsonIgnore]
    public int CommentCount => Comments?.Count ?? 0;
    public List<PostMediaReadModel> Media { get; set; } = new();

    public GeoJsonPoint<GeoJson2DGeographicCoordinates>? Location { get; set; }
    public string? LocationName { get; set; }

    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public Guid? PlaceId { get; set; }
    public string SignalType { get; set; } = "GeneralObservation";
    [BsonIgnoreIfNull]
    public string? SignalValue { get; set; }
    public string AudienceType { get; set; } = "Public";
    public string IdentityDisclosure { get; set; } = "LimitedProfile";
    public string LocationPrecision { get; set; } = "ApproximateArea";
    public string SourceType { get; set; } = "Community";
    [BsonIgnoreIfNull]
    public DateTime? ExpiresAt { get; set; }
}

public class PostCommentReadModel
{
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; }
    public Guid AuthorId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}

public class PostMediaReadModel
{
    [BsonRepresentation(BsonType.String)]
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
