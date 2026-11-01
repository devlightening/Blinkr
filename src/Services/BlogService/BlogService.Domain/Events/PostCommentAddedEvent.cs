using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events
{
    /// <param name="ParentCommentId">Top-level comment this one replies to; null for a top-level comment.
    /// Optional so events written before replies existed still deserialize.</param>
    /// <param name="AuthorName">Display name captured at write time (from the JWT), so read models and
    /// notifications never have to call IdentityService per comment.</param>
    /// <param name="PostOwnerId">Post author, so the notification consumer knows whom to notify.</param>
    /// <param name="Mentions">V2-4: people @mentioned in the text, resolved by the server.</param>
    /// <param name="AuthorHidden">V2-4: the author of an anonymous post commenting on it - notifications must not name them.</param>
    public record PostCommentAddedEvent(
       Guid PostId,
       Guid CommentId,
       Guid AuthorId,
       string CommentText,
       DateTime OccurredOn,
       Guid? ParentCommentId = null,
       string? AuthorName = null,
       Guid? PostOwnerId = null,
       IReadOnlyList<MentionRef>? Mentions = null,
       bool AuthorHidden = false) : IDomainEvent;
}
