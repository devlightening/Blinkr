using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Blinkr.Projections.Worker.Entities
{
    public class Comment
    {
        [BsonRepresentation(BsonType.String)]
        public Guid Id { get; set; }
        public Guid AuthorId { get; set; }
        /// <summary>Display name captured when the comment was written; null for comments older than this field.</summary>
        public string? AuthorName { get; set; }
        /// <summary>Top-level comment this one replies to; null for a top-level comment.</summary>
        public Guid? ParentCommentId { get; set; }
        public string Text { get; set; } = string.Empty;
        public DateTime CreatedAtUtc { get; set; }
    }

}
