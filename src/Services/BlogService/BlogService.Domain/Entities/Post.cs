namespace BlogService.Domain.Entities;

public class Post : BaseEntity
{
    public string? Title { get; set; }  
    public string? Content { get; set; } 
    public Guid AuthorId { get; set; }
    
    // Location properties for geospatial support
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? AccuracyMeters { get; set; }
    public string? LocationName { get; set; }
    
    public ICollection<PostMedia> Media { get; set; } = new List<PostMedia>();
    public ICollection<PostComment> Comments { get; set; } = new List<PostComment>();
    public ICollection<PostLike> Likes { get; set; } = new List<PostLike>();
}
