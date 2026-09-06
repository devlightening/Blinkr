using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Blinkr.Projections.Worker.Entities
{
    public class Media
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
}
