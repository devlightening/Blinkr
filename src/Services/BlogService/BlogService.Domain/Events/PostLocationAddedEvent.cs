using BlogService.Domain.Common;
using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events;

/// <summary>
/// Domain event triggered when location is added to a post
/// </summary>
public record PostLocationAddedEvent(
    Guid PostId,
    double Latitude,
    double Longitude,
    string? LocationName,
    DateTime OccurredOn
) : IDomainEvent;
