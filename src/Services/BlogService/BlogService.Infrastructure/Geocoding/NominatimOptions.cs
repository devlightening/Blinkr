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
