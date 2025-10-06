namespace BlogService.Domain.Entities;

public class Post : BaseEntity
{
    public string? Title { get; set; }  
    public string? Content { get; set; } 
    public Guid AuthorId { get; set; }
    public ICollection<PostMedia> Media { get; set; } = new List<PostMedia>();
}
