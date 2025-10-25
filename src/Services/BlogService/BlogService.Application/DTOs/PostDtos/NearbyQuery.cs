namespace BlogService.Application.DTOs.PostDtos;

/// <summary>
/// Query parameters for nearby posts search
/// </summary>
/// <param name="Lat">Latitude coordinate (-90 to 90)</param>
/// <param name="Lon">Longitude coordinate (-180 to 180)</param>
/// <param name="RadiusMeters">Search radius in meters (50 to 50,000)</param>
/// <param name="Page">Page number (1-based)</param>
/// <param name="PageSize">Items per page (1 to 50)</param>
public readonly record struct NearbyQuery(
    double Lat,
    double Lon,
    int RadiusMeters = 5_000,
    int Page = 1,
    int PageSize = 20
)
{
    /// <summary>
    /// Clamp values to safe ranges for performance and security
    /// </summary>
    public NearbyQuery Clamp() => new(
        Lat,
        Lon,
        Math.Clamp(RadiusMeters, 50, 500_000),   // 50 m – 500 km (for testing)
        Math.Max(1, Page),
        Math.Clamp(PageSize, 1, 50)
    );
}
