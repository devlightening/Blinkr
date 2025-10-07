using BlogService.Domain.Common.Interfaces;

namespace BlogService.Domain.Events
{
    public class PostLikedEvent : IDomainEvent
    {
        public Guid PostId { get; }
        public Guid UserId { get; }
        public DateTime LikedAtUtc { get; }
        public DateTime OccurredOn { get; }

        public PostLikedEvent(Guid postId, Guid userId, DateTime likedAtUtc)
        {
            PostId = postId;
            UserId = userId;
            LikedAtUtc = likedAtUtc;
            OccurredOn = DateTime.UtcNow;
        }
    }
}
