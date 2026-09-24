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
    /// <summary>
    /// Who has liked this post right now (an unlike removes the id). Must match
    /// `Blinkr.Projections.Worker.Documents.PostDocument.LikedByUserIds` and
    /// `BlogService.Infrastructure.ReadModels.PostDocument.LikedByUserIds`.
    /// </summary>
    [BsonRepresentation(BsonType.String)]
    public List<Guid> LikedByUserIds { get; set; } = new();
    /// <summary>
    /// Moderation (Faz 10): always null in "posts" - hidden/removed signals are moved to "posts_moderated" by the
    /// projection worker. Declared so documents written with the field still deserialize. Must match
    /// `Blinkr.Projections.Worker.Documents.PostDocument.ModerationState`.
    /// </summary>
    [BsonIgnoreIfNull]
    public string? ModerationState { get; set; }
    /// <summary>
    /// The server's publication trust (VERIFIED_LIVE / NEARBY_PLACE_POST / ...), so a feed or card can say "Canlı" or
    /// "Konumda" only when the server verified it (plan-devam A8/C3). Null on posts projected before it was kept.
    /// Must match the other two PostDocument copies.
    /// </summary>
    [BsonIgnoreIfNull]
    public string? PublicationTrust { get; set; }

    /// <summary>An old gallery photo (plan-devam D10) - the card says "Galeriden". Must match the other two PostDocument copies.</summary>
    [BsonIgnoreIfDefault]
    public bool FromGallery { get; set; }
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
    [BsonIgnoreIfNull]
    public string? AuthorName { get; set; }
    [BsonIgnoreIfNull]
    public Guid? ParentCommentId { get; set; }
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
