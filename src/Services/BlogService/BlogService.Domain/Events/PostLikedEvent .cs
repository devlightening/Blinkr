using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events
{
    /// <param name="PostOwnerId">Post author, so the notification consumer knows whom to notify.
    /// Optional so events written before it existed still deserialize.</param>
    /// <param name="Reaction">V2-4: the emoji (Shared.Events.Text.ReactionCatalog); null = the heart (every older like).</param>
    /// <param name="Replaces">V2-4: this person already reacted and only changed the emoji - one event, so a change can
    /// never be split into an unlike and a like that arrive out of order; and no second notification.</param>
    public record PostLikedEvent(
            Guid PostId,
            Guid UserId,
            DateTime OccurredOn,
            Guid? PostOwnerId = null,
            string? LikerName = null,
            string? Reaction = null,
            bool Replaces = false) : IDomainEvent;
}
