using Blinkr.Projections.Worker.Entities;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

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

        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAtUtc { get; set; }

        public int LikeCount { get; set; }
        public List<Comment> Comments { get; set; } = new List<Comment>();
        public List<Media> Media { get; set; } = new List<Media>();
    }
}
