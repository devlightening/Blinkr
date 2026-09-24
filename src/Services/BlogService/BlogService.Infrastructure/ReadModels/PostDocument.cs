using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace BlogService.Infrastructure.ReadModels;

/// <summary>
/// MongoDB document model for Post read model
/// Must match the structure created by Worker projections
/// </summary>
public class PostDocument
{
    /// <summary>
    /// The projection worker stores _id as a string. Mapping it as a binary GUID made every Find(p => p.Id == id)
    /// match nothing, so GET posts-read/{id} and query/posts/{id} answered 404 for posts that exist.
    /// </summary>
    [BsonId]
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
    public Guid Id { get; set; }
    
    /// <summary>
    /// Extra elements from MongoDB (e.g., distance from $geoNear)
    /// </summary>
    [BsonExtraElements]
    public MongoDB.Bson.BsonDocument? ExtraElements { get; set; }

    /// <summary>Stored as a string by the projection worker; without this, filters like Eq(AuthorId, guid) build a binary GUID and match nothing.</summary>
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
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
    /// Who has liked this post right now (not who ever has - an unlike removes the id). Used to
    /// answer "did I like this?" per request, outside the shared PostReadDto cache (kök CLAUDE.md
    /// §16: "Cache source of truth olmasin") so one user's like state never leaks to another's cached
    /// read. Must match `Blinkr.Projections.Worker.Documents.PostDocument.LikedByUserIds`.
    /// </summary>
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
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
    public List<CommentEntity> Comments { get; set; } = new();
    /// <summary>V2-4 (D-027): one reaction per person, with when it was set (a late message never overwrites a newer
    /// one). Likes projected before reactions existed are in LikedByUserIds only and read as the heart. Must match the other
    /// two PostDocument copies (their class maps reject unknown elements).</summary>
    [BsonIgnoreIfNull]
    public List<ReactionEntity>? Reactions { get; set; }
    /// <summary>V2-4: folded #hashtags of the title and text (Shared.Events.Text.TextTags). Must match the other two copies.</summary>
    [BsonIgnoreIfNull]
    public List<string>? Hashtags { get; set; }
    /// <summary>V2-4: people @mentioned in the signal, as resolved by BlogService. Must match the other two copies.</summary>
    [BsonIgnoreIfNull]
    public List<MentionEntity>? Mentions { get; set; }

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
    /// <summary>The projection worker stores a comment id as a string (Blinkr.Projections.Worker.Entities.Comment);
    /// reading it as a binary GUID threw on every post that had a comment.</summary>
    [BsonId]
    [BsonRepresentation(MongoDB.Bson.BsonType.String)]
    public Guid Id { get; set; }
    
    [BsonGuidRepresentation(MongoDB.Bson.GuidRepresentation.Standard)]
    public Guid AuthorId { get; set; }
    [BsonIgnoreIfNull]
    public string? AuthorName { get; set; }
    [BsonIgnoreIfNull]
    public Guid? ParentCommentId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    /// <summary>V2-4 (D-027): who liked this comment. Must match the other two comment copies.</summary>
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.String)]
    public List<Guid>? LikedBy { get; set; }
    /// <summary>V2-4: people @mentioned in the comment. Must match the other two comment copies.</summary>
    [BsonIgnoreIfNull]
    public List<MentionEntity>? Mentions { get; set; }
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

/// <summary>V2-4: a person's reaction on a post.</summary>
public class ReactionEntity
{
    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }
    public string Reaction { get; set; } = string.Empty;
    public DateTime AtUtc { get; set; }
}

/// <summary>V2-4: a person @mentioned, with their name at write time.</summary>
public class MentionEntity
{
    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
}
