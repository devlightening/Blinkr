using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events
{
    /// <summary>A comment was removed by its author or by the post author. Replies to it are removed with it.</summary>
    public record PostCommentRemovedEvent(
       Guid PostId,
       Guid CommentId,
       Guid RemovedByUserId,
       DateTime OccurredOn) : IDomainEvent;
}
