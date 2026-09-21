using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using PlaceService.Api.Application;
using PlaceService.Api.Domain;
using PlaceService.Api.Infrastructure;
using System.Diagnostics;

namespace PlaceService.Api.Controllers;

[ApiController]
[Route("api/places")]
public sealed class PlacesController : ControllerBase
{
    private readonly IPlaceRepository _repository;
    private readonly ICurrentPlaceStateCalculator _stateCalculator;
    private readonly IPlaceDiscoveryService _discoveryService;
    private readonly IPlaceDiscoveryRefreshQueue _refreshQueue;
    private readonly ILogger<PlacesController> _logger;
    private readonly PlaceDiscoveryOptions _discoveryOptions;

    public PlacesController(
        IPlaceRepository repository,
        ICurrentPlaceStateCalculator stateCalculator,
        IPlaceDiscoveryService discoveryService,
        IPlaceDiscoveryRefreshQueue refreshQueue,
        IOptions<PlaceDiscoveryOptions> discoveryOptions,
        ILogger<PlacesController> logger)
    {
        _repository = repository;
        _stateCalculator = stateCalculator;
        _discoveryService = discoveryService;
        _refreshQueue = refreshQueue;
        _discoveryOptions = discoveryOptions.Value;
        _logger = logger;
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var place = await _repository.GetAsync(id, ct);
        if (place is null) return NotFound();

        var signals = await _repository.GetSignalsAsync(id, 20, ct);
        return Ok(ToDetail(place, signals));
    }

    [HttpGet("{id:guid}/signals")]
    [AllowAnonymous]
    public async Task<IActionResult> Signals(Guid id, [FromQuery] int limit = 20, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 50);
        if (await _repository.GetAsync(id, ct) is null) return NotFound();

        var signals = await _repository.GetSignalsAsync(id, limit, ct);
        return Ok(signals.Take(limit).Select(ToRecentSignal));
    }

    [HttpGet("nearby")]
    [AllowAnonymous]
    public async Task<IActionResult> Nearby([FromQuery] double lat, [FromQuery] double lon, [FromQuery] int radiusMeters = 1500, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        var validation = ValidateGeo(lat, lon);
        if (validation is not null) return BadRequest(validation);
        if (radiusMeters is < 1 or > 50000) return BadRequest("radiusMeters must be between 1 and 50000.");

        limit = Math.Clamp(limit, 1, 100);
        var delta = Math.Min(0.2, Math.Max(0.002, radiusMeters / 111_000.0));
        var minLat = lat - delta;
        var minLon = lon - delta;
        var maxLat = lat + delta;
        var maxLon = lon + delta;
        var total = Stopwatch.StartNew();
        var local = Stopwatch.StartNew();
        var places = await _repository.GetNearbyAsync(lat, lon, radiusMeters, limit, ct);
        local.Stop();
        LogNearbyCatalog(places, lat, lon);

        if (places.Count > 0)
        {
            if (!await _discoveryService.HasFreshCoverageAsync(minLat, minLon, maxLat, maxLon, ct))
            {
                _refreshQueue.Enqueue(minLat, minLon, maxLat, maxLon, limit);
                LogDiscovery(local.ElapsedMilliseconds, 0, total.ElapsedMilliseconds, "LOCAL_PLUS_REFRESH", "success");
            }
            else
            {
                LogDiscovery(local.ElapsedMilliseconds, 0, total.ElapsedMilliseconds, "LOCAL", "success");
            }
            return Ok(await ToNearbySummariesAsync(places, lat, lon, ct));
        }

        if (!_discoveryOptions.AllowSynchronousProviderFallback)
        {
            Response.Headers["X-Blinkr-Place-Coverage"] = "not_loaded";
            LogDiscovery(local.ElapsedMilliseconds, 0, total.ElapsedMilliseconds, "LOCAL", "not_loaded");
            return Ok(Array.Empty<NearbyPlaceDto>());
        }

        var refresh = await _discoveryService.RefreshBoundsCoverageAsync(minLat, minLon, maxLat, maxLon, limit, ct);
        places = await _repository.GetNearbyAsync(lat, lon, radiusMeters, limit, ct);
        LogNearbyCatalog(places, lat, lon);
        LogDiscovery(local.ElapsedMilliseconds, refresh.ProviderMs, total.ElapsedMilliseconds, "PROVIDER", refresh.Status.ToString());
        return Ok(await ToNearbySummariesAsync(places, lat, lon, ct));
    }

    [HttpGet("search")]
    [AllowAnonymous]
    /// <summary>
    /// Text or category search around an origin. The composer keeps the 1.5 km default (publishing needs a nearby
    /// Place); the map's "where to?" search passes a wider <paramref name="radiusMeters"/> (up to 30 km) so someone
    /// can look at a neighbourhood they are about to go to.
    /// </summary>
    public async Task<IActionResult> Search([FromQuery] string q, [FromQuery] double lat,
        [FromQuery] double lon, [FromQuery] int radiusMeters = DefaultSearchRadiusMeters, CancellationToken ct = default)
    {
        if (ValidateGeo(lat, lon) is not null || !double.IsFinite(lat) || !double.IsFinite(lon))
            return BadRequest("Invalid origin.");
        if (string.IsNullOrWhiteSpace(q) || q.Length > 80) return BadRequest("Query must contain 1-80 characters.");
        radiusMeters = Math.Clamp(radiusMeters, 200, MaxSearchRadiusMeters);
        var limit = radiusMeters > DefaultSearchRadiusMeters * 2 ? 100 : 50;
        var places = await _repository.SearchAsync(CategoryShortcut(q), lat, lon, radiusMeters, limit, ct);
        return Ok(await ToNearbySummariesAsync(places, lat, lon, ct));
    }

    private const int DefaultSearchRadiusMeters = 1500;
    private const int MaxSearchRadiusMeters = 30_000;

    /// <summary>Everyday Turkish words for a kind of place map to the normalised category codes (CLAUDE.md 9.4).</summary>
    private static string CategoryShortcut(string q) => q.Trim().ToLowerInvariant() switch
    {
        "cami" or "mescit" => "MOSQUE",
        "park" => "PARK",
        "eczane" => "PHARMACY",
        "kafe" or "kahve" => "CAFE",
        "restoran" or "lokanta" => "RESTAURANT",
        "market" or "bakkal" => "SUPERMARKET",
        "okul" => "EDUCATION",
        "hastane" or "klinik" or "saglik" or "sağlık" => "HEALTH",
        "benzin" or "akaryakit" or "akaryakıt" => "FUEL",
        "firin" or "fırın" => "BAKERY",
        "muze" or "müze" => "TOURISM",
        "spor" => "SPORT",
        "bar" => "BAR",
        "durak" => "TRANSPORT",
        _ => q
    };

    [HttpGet("bounds")]
    [AllowAnonymous]
    public async Task<IActionResult> Bounds([FromQuery] double minLat, [FromQuery] double minLon, [FromQuery] double maxLat, [FromQuery] double maxLon, [FromQuery] int limit = 100, CancellationToken ct = default, [FromQuery] bool activeOnly = false)
    {
        if (minLat > maxLat || minLon > maxLon) return BadRequest("Invalid bounds.");
        var validation = ValidateGeo(minLat, minLon) ?? ValidateGeo(maxLat, maxLon);
        if (validation is not null) return BadRequest(validation);

        limit = Math.Clamp(limit, 1, 200);
        if (activeOnly)
            return Ok(await ToSummariesAsync(await _repository.GetActiveBoundsAsync(minLat, minLon, maxLat, maxLon, limit, ct), ct));
        var total = Stopwatch.StartNew();
        var local = Stopwatch.StartNew();
        var places = await _repository.GetBoundsAsync(minLat, minLon, maxLat, maxLon, limit, ct);
        local.Stop();

        if (places.Count > 0)
        {
            if (!await _discoveryService.HasFreshCoverageAsync(minLat, minLon, maxLat, maxLon, ct))
            {
                _refreshQueue.Enqueue(minLat, minLon, maxLat, maxLon, limit);
                LogDiscovery(local.ElapsedMilliseconds, 0, total.ElapsedMilliseconds, "LOCAL_PLUS_REFRESH", "success");
            }
            else
            {
                LogDiscovery(local.ElapsedMilliseconds, 0, total.ElapsedMilliseconds, "LOCAL", "success");
            }
            return Ok(await ToSummariesAsync(places, ct));
        }

        if (!_discoveryOptions.AllowSynchronousProviderFallback)
        {
            Response.Headers["X-Blinkr-Place-Coverage"] = "not_loaded";
            LogDiscovery(local.ElapsedMilliseconds, 0, total.ElapsedMilliseconds, "LOCAL", "not_loaded");
            return Ok(Array.Empty<PlaceSummaryDto>());
        }

        var refresh = await _discoveryService.RefreshBoundsCoverageAsync(minLat, minLon, maxLat, maxLon, limit, ct);
        places = await _repository.GetBoundsAsync(minLat, minLon, maxLat, maxLon, limit, ct);
        LogDiscovery(local.ElapsedMilliseconds, refresh.ProviderMs, total.ElapsedMilliseconds, "PROVIDER", refresh.Status.ToString());
        return Ok(await ToSummariesAsync(places, ct));
    }

    private void LogDiscovery(long localMs, long providerMs, long totalMs, string source, string status)
    {
        _logger.LogInformation(
            "[Blinkr PlaceDiscovery] localMs={LocalMs} providerMs={ProviderMs} totalMs={TotalMs} source={Source} status={Status}",
            localMs,
            providerMs,
            totalMs,
            source,
            status);
    }

    private void LogNearbyCatalog(IReadOnlyList<PlaceDocument> places, double lat, double lon)
    {
        var distances = places.Select(p => DistanceMeters(lat, lon, p.Latitude, p.Longitude)).ToArray();
        var catalogState = distances.Length == 0 ? "NOT_LOADED" : distances.Any(d => d <= 350) ? "LOADED" : "PARTIAL";
        _logger.LogInformation(
            "[Blinkr NearbyCatalog] localCandidates={LocalCandidates} within100={Within100} within200={Within200} within350={Within350} within1000={Within1000} catalogState={CatalogState}",
            distances.Length,
            distances.Count(d => d <= 100),
            distances.Count(d => d <= 200),
            distances.Count(d => d <= 350),
            distances.Count(d => d <= 1000),
            catalogState);
    }

    [HttpPost]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> Create([FromBody] CreatePlaceRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Place name is required.");
        if (string.IsNullOrWhiteSpace(request.Category)) return BadRequest("Place category is required.");
        var validation = ValidateGeo(request.Latitude, request.Longitude);
        if (validation is not null) return BadRequest(validation);

        var place = await _repository.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = place.Id }, ToSummary(place, Array.Empty<PlaceSignalDocument>()));
    }

    private async Task<IReadOnlyList<PlaceSummaryDto>> ToSummariesAsync(IReadOnlyList<PlaceDocument> places, CancellationToken ct)
    {
        var result = new List<PlaceSummaryDto>(places.Count);
        var signalGroups = (await _repository.GetSignalsForPlacesAsync(places.Select(p => p.Id).ToArray(), 20, ct))
            .GroupBy(s => s.PlaceId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<PlaceSignalDocument>)g.ToArray());

        foreach (var place in places)
        {
            signalGroups.TryGetValue(place.Id, out var signals);
            signals ??= Array.Empty<PlaceSignalDocument>();
            result.Add(ToSummary(place, signals));
        }
        return result;
    }

    private async Task<IReadOnlyList<NearbyPlaceDto>> ToNearbySummariesAsync(IReadOnlyList<PlaceDocument> places, double lat, double lon, CancellationToken ct)
    {
        var byId = places.ToDictionary(p => p.Id);
        var summaries = await ToSummariesAsync(places, ct);
        return summaries
            .Select(p => new NearbyPlaceDto(p.Id, p.Name, p.Category, p.Latitude, p.Longitude, p.DisplayAddress,
                DistanceMeters(lat, lon, p.Latitude, p.Longitude), p.CurrentState,
                byId[p.Id].ExternalProvider,
                byId[p.Id].ExternalId))
            .OrderBy(p => p.DistanceMeters)
            .ToArray();
    }

    private PlaceDetailDto ToDetail(PlaceDocument place, IReadOnlyList<PlaceSignalDocument> signals) =>
        new(place.Id, place.Name, place.Category, place.Latitude, place.Longitude, place.DisplayAddress, place.Source,
            _stateCalculator.Calculate(signals, DateTime.UtcNow), signals.Take(20).Select(ToRecentSignal).ToArray(), place.GeometryWkt);

    private PlaceSummaryDto ToSummary(PlaceDocument place, IReadOnlyList<PlaceSignalDocument> signals) =>
        new(place.Id, place.Name, place.Category, place.Latitude, place.Longitude, place.DisplayAddress,
            _stateCalculator.Calculate(signals, DateTime.UtcNow),
            signals.Count(s => s.CreatedAtUtc > DateTime.UtcNow.AddHours(-3)),
            signals.Count > 0 ? signals.Max(s => s.CreatedAtUtc) : null);

    private static RecentSignalDto ToRecentSignal(PlaceSignalDocument signal) =>
        new(signal.PostId, signal.Title, signal.Text, signal.SignalType, signal.SignalValue, signal.CreatedAtUtc,
            signal.ExpiresAtUtc, signal.LocationName, signal.Media.Select(m => new RecentSignalMediaDto(m.Url, m.MediaType, m.MediaId, m.ContentType, m.SizeBytes, m.Width, m.Height, m.DurationSeconds, m.ThumbnailUrl)).ToArray(), signal.PublicationTrust, signal.AuthorName);

    private static string? ValidateGeo(double lat, double lon)
    {
        if (lat is < -90 or > 90) return "Latitude must be between -90 and 90.";
        if (lon is < -180 or > 180) return "Longitude must be between -180 and 180.";
        return null;
    }

    private static double DistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadius = 6371000;
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return earthRadius * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180;
}
