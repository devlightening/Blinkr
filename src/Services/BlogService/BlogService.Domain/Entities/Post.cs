namespace BlogService.Domain.Entities;

public class Post
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Title { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public Guid AuthorId { get; set; } // IdentityService’deki User’ın Id’si

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
