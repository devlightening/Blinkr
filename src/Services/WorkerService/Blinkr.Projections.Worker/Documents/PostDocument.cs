using Blinkr.Projections.Worker.Entities;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver.GeoJsonObjectModel;

namespace Blinkr.Projections.Worker.Documents
{
    public class PostDocument
    {
        [BsonId]
        // Store Guid as string in Mongo to avoid GuidRepresentation ambiguity
        [BsonRepresentation(BsonType.String)]
        public Guid Id { get; set; }

        // Also store AuthorId as string to avoid GuidRepresentation issues
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
        /// Who has liked this post right now (not who ever has - an unlike removes the id). Lets a
        /// per-request "did I like this?" check avoid poisoning the shared, user-independent
        /// PostReadDto cache (kök CLAUDE.md §16: "Cache source of truth olmasin").
        /// </summary>
        [BsonRepresentation(BsonType.String)]
        public List<Guid> LikedByUserIds { get; set; } = new List<Guid>();
        /// <summary>
        /// Moderation (Faz 10): null = visible; "hidden" (reports or a moderator; can be restored) or "removed" only
        /// ever appear in the "posts_moderated" collection, never in "posts" (PostModerationChangedConsumer).
        /// Not written when null, and mirrored in both BlogService PostDocument copies, whose class maps reject
        /// unknown elements.
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
        public List<Comment> Comments { get; set; } = new List<Comment>();
        
        /// <summary>
        /// Computed property for comment count
        /// </summary>
        [BsonIgnore]
        public int CommentCount => Comments?.Count ?? 0;
        public List<Media> Media { get; set; } = new List<Media>();
        
        // Location support - GeoJSON Point for 2dsphere indexing
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
}
