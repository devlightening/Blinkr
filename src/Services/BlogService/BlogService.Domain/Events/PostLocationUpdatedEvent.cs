using BlogService.Domain.Common;
using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events;

/// <summary>
/// Domain event triggered when post location is updated
/// </summary>
public record PostLocationUpdatedEvent(
    Guid PostId,
    double Latitude,
    double Longitude,
    string? LocationName,
    DateTime OccurredOn
) : IDomainEvent;
