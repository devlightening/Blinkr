using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events
{
    /// <summary>V2-4 (D-027): someone liked a comment. Anyone who can read the post may, the comment's author too.</summary>
    public record PostCommentLikedEvent(Guid PostId, Guid CommentId, Guid UserId, DateTime OccurredOn) : IDomainEvent;

    /// <summary>V2-4 (D-027): the comment like was taken back.</summary>
    public record PostCommentUnlikedEvent(Guid PostId, Guid CommentId, Guid UserId, DateTime OccurredOn) : IDomainEvent;
}
