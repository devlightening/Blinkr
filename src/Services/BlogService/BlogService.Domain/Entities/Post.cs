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
    public Guid? PlaceId { get; set; }
    public string SignalType { get; set; } = "GeneralObservation";
    public string? SignalValue { get; set; }
    public string AudienceType { get; set; } = "Public";
    public string IdentityDisclosure { get; set; } = "LimitedProfile";
    public string LocationPrecision { get; set; } = "ApproximateArea";
    public string SourceType { get; set; } = "Community";
    public DateTime? ExpiresAt { get; set; }
    
    public ICollection<PostMedia> Media { get; set; } = new List<PostMedia>();
    public ICollection<PostComment> Comments { get; set; } = new List<PostComment>();
    public ICollection<PostLike> Likes { get; set; } = new List<PostLike>();
}
