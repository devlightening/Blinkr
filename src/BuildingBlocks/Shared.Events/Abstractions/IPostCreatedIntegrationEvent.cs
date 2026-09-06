using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Shared.Events.Abstractions
{
    public interface IPostCreatedIntegrationEvent
    {
        Guid Id { get; }
        Guid PostId { get; }
        Guid AuthorId { get; }
        string Title { get; }
        string Content { get; }
        DateTime OccurredOn { get; }
        
        // Author information
        string? AuthorName { get; }
        string? AuthorGender { get; }
        
        // Location fields for geospatial support
        double? Latitude { get; }
        double? Longitude { get; }
        double? AccuracyMeters { get; }
        string? LocationName { get; }
        Guid? PlaceId { get; }
        string? SignalType { get; }
        string? SignalValue { get; }
        string? AudienceType { get; }
        string? IdentityDisclosure { get; }
        string? LocationPrecision { get; }
        string? SourceType { get; }
        DateTime? ExpiresAt { get; }
        
        // Media
        ICollection<PostMediaInfo>? Media { get; }
    }

    public class PostMediaInfo
    {
        public Guid? MediaId { get; set; }
        public string? Url { get; set; }
        public string? MediaType { get; set; }
        public string? ContentType { get; set; }
        public long? SizeBytes { get; set; }
        public int? Width { get; set; }
        public int? Height { get; set; }
        public double? DurationSeconds { get; set; }
        public string? ThumbnailUrl { get; set; }
    }
}
