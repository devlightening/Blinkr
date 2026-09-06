using Microsoft.Extensions.Options;
using PlaceService.Api.Application;
using System.Globalization;

namespace PlaceService.Api.Infrastructure;

public interface IPlaceDiscoveryService
{
    Task EnsureBoundsCoverageAsync(double minLat, double minLon, double maxLat, double maxLon, int limit, CancellationToken ct);
}

public sealed class PlaceDiscoveryService : IPlaceDiscoveryService
{
    private readonly IPlaceRepository _repository;
    private readonly IPlaceDiscoveryProvider _provider;
    private readonly PlaceDiscoveryOptions _options;
    private readonly ILogger<PlaceDiscoveryService> _logger;

    public PlaceDiscoveryService(
        IPlaceRepository repository,
        IPlaceDiscoveryProvider provider,
        IOptions<PlaceDiscoveryOptions> options,
        ILogger<PlaceDiscoveryService> logger)
    {
        _repository = repository;
        _provider = provider;
        _options = options.Value;
        _logger = logger;
    }

    public async Task EnsureBoundsCoverageAsync(double minLat, double minLon, double maxLat, double maxLon, int limit, CancellationToken ct)
    {
        if (!_options.Enabled) return;

        var key = CoverageKey(minLat, minLon, maxLat, maxLon);
        var ttl = TimeSpan.FromMinutes(Math.Clamp(_options.CoverageTtlMinutes, 5, 43200));
        if (await _repository.HasFreshCoverageAsync(key, ttl, ct))
        {
            _logger.LogInformation("[Blinkr Places] source=cache status=success count=coverage coverageKey={CoverageKey}", key);
            return;
        }

        var discovery = await _provider.DiscoverAsync(minLat, minLon, maxLat, maxLon, Math.Min(limit, _options.MaxViewportPlaces), ct);
        if (discovery.Status is PlaceDiscoveryStatus.Failure or PlaceDiscoveryStatus.Timeout)
        {
            _logger.LogWarning("[Blinkr Places] source=provider status={Status} count=0 coverageKey={CoverageKey}", discovery.Status, key);
            return;
        }

        var upserted = await _repository.UpsertDiscoveredAsync(discovery.Places, ct);
        await _repository.MarkCoverageAsync(key, _provider.Name, discovery.Status == PlaceDiscoveryStatus.Empty ? "empty" : "success", upserted.Count, ct);
        _logger.LogInformation("[Blinkr Places] source=provider status={Status} count={Count} coverageKey={CoverageKey}", discovery.Status, upserted.Count, key);
    }

    private static string CoverageKey(double minLat, double minLon, double maxLat, double maxLon)
    {
        static double Snap(double value) => Math.Floor(value * 100) / 100;
        return string.Create(CultureInfo.InvariantCulture, $"{Snap(minLat):F2}:{Snap(minLon):F2}:{Snap(maxLat):F2}:{Snap(maxLon):F2}");
    }
}
