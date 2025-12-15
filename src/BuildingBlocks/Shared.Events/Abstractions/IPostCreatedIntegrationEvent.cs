using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Shared.Events.Abstractions
{
    public interface IPostCreatedIntegrationEvent
    {
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
        
        // Media
        ICollection<PostMediaInfo>? Media { get; }
    }

    public class PostMediaInfo
    {
        public string? Url { get; set; }
        public string? MediaType { get; set; }
    }
}
