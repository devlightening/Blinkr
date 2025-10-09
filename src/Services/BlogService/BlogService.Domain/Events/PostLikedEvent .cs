using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events
{
    public record PostLikedEvent(
            Guid PostId,
            Guid UserId,
            DateTime OccurredOn) : IDomainEvent;
}
