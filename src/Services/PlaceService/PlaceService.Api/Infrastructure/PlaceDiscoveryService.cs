using Microsoft.Extensions.Options;
using PlaceService.Api.Application;
using System.Globalization;
using System.Diagnostics;

namespace PlaceService.Api.Infrastructure;

public interface IPlaceDiscoveryService
{
    string CreateCoverageKey(double minLat, double minLon, double maxLat, double maxLon);
    Task<bool> HasFreshCoverageAsync(double minLat, double minLon, double maxLat, double maxLon, CancellationToken ct);
    Task<PlaceDiscoveryRefreshResult> RefreshBoundsCoverageAsync(double minLat, double minLon, double maxLat, double maxLon, int limit, CancellationToken ct);
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

    public string CreateCoverageKey(double minLat, double minLon, double maxLat, double maxLon) => CoverageKey(minLat, minLon, maxLat, maxLon);

    public async Task<bool> HasFreshCoverageAsync(double minLat, double minLon, double maxLat, double maxLon, CancellationToken ct)
    {
        if (!_options.Enabled) return true;
        var ttl = TimeSpan.FromMinutes(Math.Clamp(_options.CoverageTtlMinutes, 5, 43200));
        return await _repository.HasFreshCoverageAsync(CoverageKey(minLat, minLon, maxLat, maxLon), ttl, ct);
    }

    public async Task<PlaceDiscoveryRefreshResult> RefreshBoundsCoverageAsync(double minLat, double minLon, double maxLat, double maxLon, int limit, CancellationToken ct)
    {
        var total = Stopwatch.StartNew();
        if (!_options.Enabled) return new PlaceDiscoveryRefreshResult(PlaceDiscoveryStatus.Empty, 0, 0, 0, 0, total.ElapsedMilliseconds);

        var key = CoverageKey(minLat, minLon, maxLat, maxLon);
        var coverage = Stopwatch.StartNew();
        var ttl = TimeSpan.FromMinutes(Math.Clamp(_options.CoverageTtlMinutes, 5, 43200));
        if (await _repository.HasFreshCoverageAsync(key, ttl, ct))
        {
            coverage.Stop();
            _logger.LogInformation("[Blinkr Places] source=cache status=success count=coverage coverage={Coverage}", CoverageLogId(key));
            _logger.LogInformation(
                "[Blinkr PlaceDiscovery] localMs=0 coverageMs={CoverageMs} providerMs=0 normalizationMs=0 totalMs={TotalMs} source=LOCAL status=coverage_fresh",
                coverage.ElapsedMilliseconds,
                total.ElapsedMilliseconds);
            return new PlaceDiscoveryRefreshResult(PlaceDiscoveryStatus.Success, 0, coverage.ElapsedMilliseconds, 0, 0, total.ElapsedMilliseconds);
        }

        coverage.Stop();
        var provider = Stopwatch.StartNew();
        var discovery = await _provider.DiscoverAsync(minLat, minLon, maxLat, maxLon, Math.Min(limit, _options.MaxViewportPlaces), ct);
        provider.Stop();
        if (discovery.Status is PlaceDiscoveryStatus.Failure or PlaceDiscoveryStatus.Timeout)
        {
            await _repository.MarkCoverageAsync(key, _provider.Name, discovery.Status == PlaceDiscoveryStatus.Timeout ? "provider_timeout" : "provider_failure", 0, ct);
            _logger.LogWarning("[Blinkr Places] source=provider status={Status} count=0 coverage={Coverage}", discovery.Status, CoverageLogId(key));
            _logger.LogInformation(
                "[Blinkr PlaceDiscovery] localMs=0 coverageMs={CoverageMs} providerMs={ProviderMs} normalizationMs=0 totalMs={TotalMs} source=PROVIDER status={Status}",
                coverage.ElapsedMilliseconds,
                provider.ElapsedMilliseconds,
                total.ElapsedMilliseconds,
                discovery.Status);
            return new PlaceDiscoveryRefreshResult(discovery.Status, 0, coverage.ElapsedMilliseconds, provider.ElapsedMilliseconds, 0, total.ElapsedMilliseconds);
        }

        var normalization = Stopwatch.StartNew();
        var upserted = await _repository.UpsertDiscoveredAsync(discovery.Places, ct);
        normalization.Stop();
        await _repository.MarkCoverageAsync(key, _provider.Name, discovery.Status == PlaceDiscoveryStatus.Empty ? "empty" : "success", upserted.Count, ct);
        _logger.LogInformation("[Blinkr Places] source=provider status={Status} count={Count} coverage={Coverage}", discovery.Status, upserted.Count, CoverageLogId(key));
        _logger.LogInformation(
            "[Blinkr PlaceDiscovery] localMs=0 coverageMs={CoverageMs} providerMs={ProviderMs} normalizationMs={NormalizationMs} totalMs={TotalMs} source=PROVIDER status={Status}",
            coverage.ElapsedMilliseconds,
            provider.ElapsedMilliseconds,
            normalization.ElapsedMilliseconds,
            total.ElapsedMilliseconds,
            discovery.Status);
        return new PlaceDiscoveryRefreshResult(discovery.Status, upserted.Count, coverage.ElapsedMilliseconds, provider.ElapsedMilliseconds, normalization.ElapsedMilliseconds, total.ElapsedMilliseconds);
    }

    /// <summary>A short one-way id for a coverage key, so logs can correlate a viewport without its coordinates.</summary>
    public static string CoverageLogId(string key) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(key)))[..10];

    private static string CoverageKey(double minLat, double minLon, double maxLat, double maxLon)
    {
        static double Snap(double value) => Math.Floor(value * 100) / 100;
        return string.Create(CultureInfo.InvariantCulture, $"{Snap(minLat):F2}:{Snap(minLon):F2}:{Snap(maxLat):F2}:{Snap(maxLon):F2}");
    }
}
