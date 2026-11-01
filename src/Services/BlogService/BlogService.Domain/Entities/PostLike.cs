namespace BlogService.Domain.Entities
{
    public class PostLike
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PostId { get; set; }
        public Guid UserId { get; set; }
        public DateTime LikedAtUtc { get; set; } = DateTime.UtcNow;
        /// <summary>V2-4: the emoji; null = the heart. Event-sourced only, not an EF column.</summary>
        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public string? Reaction { get; set; }

        // İlişki
        public Post Post { get; set; } = null!;
    }
}
