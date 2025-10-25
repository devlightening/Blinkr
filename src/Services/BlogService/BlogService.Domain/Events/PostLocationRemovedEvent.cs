using BlogService.Domain.Common;
using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events;

/// <summary>
/// Domain event triggered when location is removed from a post
/// </summary>
public record PostLocationRemovedEvent(
    Guid PostId,
    DateTime OccurredOn
) : IDomainEvent;
