namespace BlogService.Infrastructure.Geocoding;

/// <summary>
/// Configuration options for Nominatim geocoding service
/// </summary>
public sealed class NominatimOptions
{
    public string BaseUrl { get; set; } = "https://nominatim.openstreetmap.org/";
    public int TimeoutSeconds { get; set; } = 5;
    public string Culture { get; set; } = "tr,en";
    public string UserAgent { get; set; } = "Blinkr/1.0 (contact: dev@blinkr.local)";
    public int MaxConcurrency { get; set; } = 2;
    public int MaxRequestsPerMinute { get; set; } = 60;
    public int CacheTtlHours { get; set; } = 24;
}

/// <summary>
/// Configuration options for NOW/LIVE feed decay algorithm
/// </summary>
public sealed class NowFeedOptions
{
    /// <summary>
    /// Half-life for exponential decay in seconds (default: 5400 = 1.5 hours)
    /// </summary>
    public int DecayHalfLifeSec { get; set; } = 5400;
    
    /// <summary>
    /// Weight multiplier for likes in engagement score
    /// </summary>
    public double LikeWeight { get; set; } = 2.0;
    
    /// <summary>
    /// Weight multiplier for comments in engagement score
    /// </summary>
    public double CommentWeight { get; set; } = 3.0;
    
    /// <summary>
    /// Weight multiplier for views in engagement score
    /// </summary>
    public double ViewWeight { get; set; } = 0.5;
    
    /// <summary>
    /// Alpha parameter for distance decay: exp(-distanceKm / alpha)
    /// Set to 0 to disable distance decay
    /// </summary>
    public double DistanceDecayAlpha { get; set; } = 2.0;
    
    /// <summary>
    /// Maximum allowed radius in kilometers
    /// </summary>
    public double MaxRadiusKm { get; set; } = 10.0;
    
    /// <summary>
    /// Maximum allowed sinceMinutes filter
    /// </summary>
    public int MaxSinceMinutes { get; set; } = 1440;
    
    /// <summary>
    /// Default sinceMinutes if not specified
    /// </summary>
    public int DefaultSinceMinutes { get; set; } = 180;
}
