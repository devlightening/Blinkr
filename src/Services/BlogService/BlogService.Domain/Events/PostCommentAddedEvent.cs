using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events
{
    public class PostCommentAddedEvent : IDomainEvent
    {
        public Guid PostId { get; }
        public Guid AuthorId { get; }
        public string CommentText { get; }
        public DateTime CreatedAtUtc { get; }
        public DateTime OccurredOn { get; }
        public PostCommentAddedEvent(Guid postId, Guid authorId, string commentText, DateTime createdAtUtc)
        {
            PostId = postId;
            AuthorId = authorId;
            CommentText = commentText;
            CreatedAtUtc = createdAtUtc;
            OccurredOn = DateTime.UtcNow;
        }
    }
}
