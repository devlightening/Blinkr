using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using System.Globalization;
using BlogService.Application.Services;

namespace BlogService.Infrastructure.Geocoding;

/// <summary>
/// Caching decorator for geocoding service with Redis backend
/// </summary>
public sealed class CachingGeocodingService : IGeocodingService
{
    private readonly IDistributedCache _cache;
    private readonly IGeocodingService _innerService;
    private readonly TimeSpan _cacheTtl;
    private readonly ILogger<CachingGeocodingService> _logger;

    private const string NullPlaceholder = "__null__";

    public CachingGeocodingService(
        IDistributedCache cache, 
        IGeocodingService innerService, 
        ILogger<CachingGeocodingService> logger,
        TimeSpan? cacheTtl = null)
    {
        _cache = cache;
        _innerService = innerService;
        _logger = logger;
        _cacheTtl = cacheTtl ?? TimeSpan.FromHours(24);
    }

    public async Task<string?> TryReverseAsync(double lat, double lon, CancellationToken ct = default)
    {
        var cacheKey = GenerateCacheKey(lat, lon);

        try
        {
            // Try cache first
            var cached = await _cache.GetStringAsync(cacheKey, ct);
            if (cached is not null)
            {
                _logger.LogDebug("🌍 Geocoding cache HIT: {CacheKey}", cacheKey);
                return cached == NullPlaceholder ? null : cached;
            }

            // Cache miss - call inner service
            _logger.LogDebug("🌍 Geocoding cache MISS: {CacheKey}", cacheKey);
            var result = await _innerService.TryReverseAsync(lat, lon, ct);

            // Cache the result (including null results to avoid repeated calls)
            await CacheResult(cacheKey, result, ct);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "🌍 Geocoding cache error, falling back to direct call");
            return await _innerService.TryReverseAsync(lat, lon, ct);
        }
    }

    private static string GenerateCacheKey(double lat, double lon)
    {
        // Round to 6 decimal places (~1m precision) for cache efficiency
        static string Round(double value) => 
            Math.Round(value, 6, MidpointRounding.AwayFromZero)
                .ToString(CultureInfo.InvariantCulture);

        return $"geo:rev:{Round(lat)}:{Round(lon)}";
    }

    private async Task CacheResult(string cacheKey, string? result, CancellationToken ct)
    {
        try
        {
            var cacheValue = result ?? NullPlaceholder;
            var options = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = _cacheTtl
            };

            await _cache.SetStringAsync(cacheKey, cacheValue, options, ct);
            _logger.LogDebug("🌍 Geocoding result cached: {CacheKey}, TTL: {TTL}", cacheKey, _cacheTtl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "🌍 Failed to cache geocoding result: {CacheKey}", cacheKey);
        }
    }
}
