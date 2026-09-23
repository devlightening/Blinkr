using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events
{
    /// <param name="PostOwnerId">Post author, so the notification consumer knows whom to notify.
    /// Optional so events written before it existed still deserialize.</param>
    public record PostLikedEvent(
            Guid PostId,
            Guid UserId,
            DateTime OccurredOn,
            Guid? PostOwnerId = null) : IDomainEvent;
}
