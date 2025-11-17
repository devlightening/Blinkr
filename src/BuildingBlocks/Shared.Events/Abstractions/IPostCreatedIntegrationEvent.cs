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
        
        // Location fields for geospatial support
        double? Latitude { get; }
        double? Longitude { get; }
        double? AccuracyMeters { get; }
        string? LocationName { get; }
    }
}
