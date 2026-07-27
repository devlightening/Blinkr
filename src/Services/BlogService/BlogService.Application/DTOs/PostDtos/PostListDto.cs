namespace BlogService.Application.DTOs.PostDtos;

/// <summary>
/// Post item for list responses (lightweight)
/// </summary>
public record PostListDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
    public Guid AuthorId { get; init; }
    public string AuthorName { get; init; } = string.Empty;
    public string? AuthorGender { get; init; }  // "Male", "Female", "Other", null
    public DateTime CreatedAt { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime? UpdatedAtUtc { get; init; }
    public int LikeCount { get; init; }
    public int CommentCount { get; init; }
    public List<string> MediaUrls { get; init; } = new();
    public string? LocationName { get; init; }
    public object? Location { get; init; }
    public Guid? PlaceId { get; init; }
    public string SignalType { get; init; } = "GeneralObservation";
    public string? SignalValue { get; init; }
    public string AudienceType { get; init; } = "Public";
    public string IdentityDisclosure { get; init; } = "LimitedProfile";
    public string LocationPrecision { get; init; } = "ApproximateArea";
    public string SourceType { get; init; } = "Community";
    public DateTime? ExpiresAt { get; init; }
    
    /// <summary>
    /// Latitude (extracted from Location GeoJSON)
    /// </summary>
    public double? Latitude { get; init; }
    
    /// <summary>
    /// Longitude (extracted from Location GeoJSON)
    /// </summary>
    public double? Longitude { get; init; }
    
    /// <summary>
    /// Distance in meters (populated by $geoNear queries)
    /// </summary>
    public double? DistanceMeters { get; init; }
    
    /// <summary>
    /// Freshness in seconds (how old is the post)
    /// </summary>
    public int? FreshnessSec { get; init; }
    
    /// <summary>
    /// Is this a "live" post (created within last hour)
    /// </summary>
    public bool IsLive { get; init; }
    
    /// <summary>
    /// Decay-adjusted ranking score for NOW feed
    /// </summary>
    public double? DecayScore { get; init; }

    /// <summary>
    /// Content preview (first 200 chars)
    /// </summary>
    public string ContentPreview => Content.Length > 200 
        ? Content[..200] + "..." 
        : Content;
}
