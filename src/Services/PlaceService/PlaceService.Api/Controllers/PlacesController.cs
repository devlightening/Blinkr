using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlaceService.Api.Application;
using PlaceService.Api.Domain;
using PlaceService.Api.Infrastructure;

namespace PlaceService.Api.Controllers;

[ApiController]
[Route("api/places")]
public sealed class PlacesController : ControllerBase
{
    private readonly IPlaceRepository _repository;
    private readonly ICurrentPlaceStateCalculator _stateCalculator;
    private readonly IPlaceDiscoveryService _discoveryService;

    public PlacesController(IPlaceRepository repository, ICurrentPlaceStateCalculator stateCalculator, IPlaceDiscoveryService discoveryService)
    {
        _repository = repository;
        _stateCalculator = stateCalculator;
        _discoveryService = discoveryService;
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
        return Ok(signals.Select(ToRecentSignal));
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
        await _discoveryService.EnsureBoundsCoverageAsync(lat - delta, lon - delta, lat + delta, lon + delta, limit, ct);
        var places = await _repository.GetNearbyAsync(lat, lon, radiusMeters, limit, ct);
        return Ok(await ToNearbySummariesAsync(places, lat, lon, ct));
    }

    [HttpGet("bounds")]
    [AllowAnonymous]
    public async Task<IActionResult> Bounds([FromQuery] double minLat, [FromQuery] double minLon, [FromQuery] double maxLat, [FromQuery] double maxLon, [FromQuery] int limit = 100, CancellationToken ct = default)
    {
        if (minLat > maxLat || minLon > maxLon) return BadRequest("Invalid bounds.");
        var validation = ValidateGeo(minLat, minLon) ?? ValidateGeo(maxLat, maxLon);
        if (validation is not null) return BadRequest(validation);

        limit = Math.Clamp(limit, 1, 200);
        await _discoveryService.EnsureBoundsCoverageAsync(minLat, minLon, maxLat, maxLon, limit, ct);
        var places = await _repository.GetBoundsAsync(minLat, minLon, maxLat, maxLon, limit, ct);
        return Ok(await ToSummariesAsync(places, ct));
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
        var summaries = await ToSummariesAsync(places, ct);
        return summaries
            .Select(p => new NearbyPlaceDto(p.Id, p.Name, p.Category, p.Latitude, p.Longitude, p.DisplayAddress,
                DistanceMeters(lat, lon, p.Latitude, p.Longitude), p.CurrentState))
            .OrderBy(p => p.DistanceMeters)
            .ToArray();
    }

    private PlaceDetailDto ToDetail(PlaceDocument place, IReadOnlyList<PlaceSignalDocument> signals) =>
        new(place.Id, place.Name, place.Category, place.Latitude, place.Longitude, place.DisplayAddress, place.Source,
            _stateCalculator.Calculate(signals, DateTime.UtcNow), signals.Take(20).Select(ToRecentSignal).ToArray());

    private PlaceSummaryDto ToSummary(PlaceDocument place, IReadOnlyList<PlaceSignalDocument> signals) =>
        new(place.Id, place.Name, place.Category, place.Latitude, place.Longitude, place.DisplayAddress,
            _stateCalculator.Calculate(signals, DateTime.UtcNow));

    private static RecentSignalDto ToRecentSignal(PlaceSignalDocument signal) =>
        new(signal.PostId, signal.Title, signal.Text, signal.SignalType, signal.SignalValue, signal.CreatedAtUtc,
            signal.ExpiresAtUtc, signal.LocationName, signal.Media.Select(m => new RecentSignalMediaDto(m.Url, m.MediaType, m.MediaId, m.ContentType, m.SizeBytes, m.Width, m.Height, m.DurationSeconds, m.ThumbnailUrl)).ToArray());

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
