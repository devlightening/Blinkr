namespace BlogService.Application.Services;

/// <summary>
/// Service for reverse geocoding coordinates to location names
/// </summary>
public interface IGeocodingService
{
    /// <summary>
    /// Try to get location name from coordinates (cached implementation)
    /// </summary>
    /// <param name="lat">Latitude</param>
    /// <param name="lon">Longitude</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Location name or null if not found/failed</returns>
    Task<string?> TryReverseAsync(double lat, double lon, CancellationToken ct = default);
}
