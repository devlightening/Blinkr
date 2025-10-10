using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;


namespace Blinkr.Projections.Worker.Entities
{
    public class Comment
    {
        [BsonRepresentation(BsonType.String)]
        public Guid Id { get; set; }
        public Guid AuthorId { get; set; }
        public string Text { get; set; } = string.Empty;
        public DateTime CreatedAtUtc { get; set; }
    }

}
