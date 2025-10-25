using BlogService.Application.Services;

namespace BlogService.Api.Services;

/// <summary>
/// No-op geocoding service for development/testing
/// Will be replaced with real implementation in L2.3
/// </summary>
public sealed class NoOpGeocodingService : IGeocodingService
{
    private readonly ILogger<NoOpGeocodingService> _logger;

    public NoOpGeocodingService(ILogger<NoOpGeocodingService> logger)
    {
        _logger = logger;
    }

    public Task<string?> TryReverseAsync(double lat, double lon, CancellationToken ct = default)
    {
        _logger.LogDebug("🌍 NoOp geocoding: lat={Lat}, lon={Lon} (will be implemented in L2.3)", lat, lon);
        return Task.FromResult<string?>(null);
    }
}
