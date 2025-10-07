namespace BlogService.Domain.Entities
{
    public class PostLike
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PostId { get; set; }
        public Guid UserId { get; set; }
        public DateTime LikedAtUtc { get; set; } = DateTime.UtcNow;

        // İlişki
        public Post Post { get; set; } = null!;
    }
}
