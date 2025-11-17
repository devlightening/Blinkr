using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events
{
    public record PostCreatedEvent(
        Guid PostId, 
        Guid AuthorId, 
        string Title, 
        string Content, 
        DateTime OccurredOn,
        double? Latitude = null,
        double? Longitude = null,
        double? AccuracyMeters = null,
        string? LocationName = null) : IDomainEvent;
}
