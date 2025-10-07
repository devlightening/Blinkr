namespace BlogService.Domain.Entities
{
    public class PostComment
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PostId { get; set; }
        public string CommentText { get; set; } = string.Empty;
        public Guid AuthorId { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public Guid? ParentCommentId { get; set; }  

        // İlişki
        public Post Post { get; set; } = null!;
    }
}
