using Microsoft.Extensions.Logging;
using BlogService.Application.Services;

namespace BlogService.Infrastructure.Geocoding;

/// <summary>
/// Concurrency-constrained geocoding service to prevent overwhelming external APIs
/// </summary>
public sealed class ConstrainedGeocodingService : IGeocodingService
{
    private readonly IGeocodingService _innerService;
    private readonly SemaphoreSlim _concurrencyGate;
    private readonly ILogger<ConstrainedGeocodingService> _logger;

    public ConstrainedGeocodingService(
        IGeocodingService innerService, 
        SemaphoreSlim concurrencyGate,
        ILogger<ConstrainedGeocodingService> logger)
    {
        _innerService = innerService;
        _concurrencyGate = concurrencyGate;
        _logger = logger;
    }

    public async Task<string?> TryReverseAsync(double lat, double lon, CancellationToken ct = default)
    {
        _logger.LogDebug("🌍 Waiting for geocoding concurrency slot...");
        
        await _concurrencyGate.WaitAsync(ct);
        try
        {
            _logger.LogDebug("🌍 Acquired geocoding concurrency slot");
            return await _innerService.TryReverseAsync(lat, lon, ct);
        }
        finally
        {
            _concurrencyGate.Release();
            _logger.LogDebug("🌍 Released geocoding concurrency slot");
        }
    }
}
