using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Common.Root;
using BlogService.Domain.Events;

namespace BlogService.Domain.Entities
{
    public class PostAggregate : AggregateRoot
    {
        public Guid AuthorId { get; private set; }
        public string Title { get; private set; }
        public string Content { get; private set; }
        public ICollection<PostMedia> Media { get; private set; } = new List<PostMedia>();
        public ICollection<PostComment> Comments { get; private set; } = new List<PostComment>();
        public ICollection<PostLike> Likes { get; private set; } = new List<PostLike>();

        public PostAggregate() { }

        public static PostAggregate Create(Guid postId, Guid authorId, string title, string content)
        {
            var post = new PostAggregate();
            post.ApplyNewEvent(new PostCreatedEvent(postId, authorId, title, content, DateTime.UtcNow));
            return post;
        }

        public void AddComment(Guid authorId, string commentText)
        {
            var @event = new PostCommentAddedEvent(Id, authorId, commentText, DateTime.UtcNow);
            ApplyNewEvent(@event); // Event'i işleyip kaydediyoruz
        }

        public void AddLike(Guid userId)
        {
            var @event = new PostLikedEvent(Id, userId, DateTime.UtcNow);
            ApplyNewEvent(@event);
        }

        private void Apply(PostCreatedEvent e)
        {
            Id = e.PostId;
            AuthorId = e.AuthorId;
            Title = e.Title;
            Content = e.Content;
        }

        private void Apply(PostCommentAddedEvent e)
        {
            Comments.Add(new PostComment
            {
                PostId = e.PostId,
                AuthorId = e.AuthorId,
                CommentText = e.CommentText,
                CreatedAtUtc = e.CreatedAtUtc
            });
        }

        private void Apply(PostLikedEvent e)
        {
            Likes.Add(new PostLike
            {
                PostId = e.PostId,
                UserId = e.UserId,
                LikedAtUtc = e.LikedAtUtc
            });
        }   
    }
}
