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
        string? LocationName = null,
        string? AuthorName = null,
        string? AuthorGender = null,
        Guid? PlaceId = null,
        string SignalType = "GeneralObservation",
        string? SignalValue = null,
        string AudienceType = "Public",
        string IdentityDisclosure = "LimitedProfile",
        string LocationPrecision = "ApproximateArea",
        string SourceType = "Community",
        DateTime? ExpiresAt = null,
        ICollection<PostMediaInfo>? Media = null) : IDomainEvent;

    public record PostMediaInfo(string Url, string MediaType);
}
