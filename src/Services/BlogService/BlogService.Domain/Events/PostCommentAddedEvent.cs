using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events
{
    public record PostCommentAddedEvent(
       Guid PostId,
       Guid CommentId,
       Guid AuthorId,
       string CommentText,
       DateTime OccurredOn) : IDomainEvent;
}
