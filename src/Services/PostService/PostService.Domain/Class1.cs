using NetTopologySuite.Geometries;

namespace PostService.Domain.Entities;

/// <summary>
/// Post entity with PostGIS support
/// </summary>
public class Post
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Content { get; set; }
    public string? MediaUrl { get; set; }
    
    /// <summary>
    /// PostGIS Point (SRID 4326 = WGS84)
    /// </summary>
    public Point? Location { get; set; }
    
    public string Visibility { get; set; } = "Public"; // Public, Friends, Private
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Computed properties for easier access
    public double? Latitude => Location?.Y;
    public double? Longitude => Location?.X;
}
