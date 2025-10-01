namespace BlogService.Domain.Entities;

public class Post
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string? Title { get; set; }  
    public string? Content { get; set; } 
    public Guid AuthorId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<PostMedia> Media { get; set; } = new List<PostMedia>();
}
