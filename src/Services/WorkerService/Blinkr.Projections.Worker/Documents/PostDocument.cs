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
