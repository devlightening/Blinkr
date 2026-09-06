using System.Net.Http.Json;
using System.Globalization;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Services.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogService.Api.Controllers;

[ApiController]
[Route("api/map")]
[AllowAnonymous]
public sealed class MapController : ControllerBase
{
    private readonly IPostQueryService _postQueryService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MapController> _logger;

    public MapController(
        IPostQueryService postQueryService,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<MapController> logger)
    {
        _postQueryService = postQueryService;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet("bounds")]
    public async Task<IActionResult> Bounds(
        [FromQuery] double? north,
        [FromQuery] double? south,
        [FromQuery] double? east,
        [FromQuery] double? west,
        [FromQuery] double? minLat,
        [FromQuery] double? minLon,
        [FromQuery] double? maxLat,
        [FromQuery] double? maxLon,
        [FromQuery] int sinceMinutes = 180,
        [FromQuery] int limit = 150,
        CancellationToken ct = default)
    {
        var effectiveMinLat = south ?? minLat;
        var effectiveMaxLat = north ?? maxLat;
        var effectiveMinLon = west ?? minLon;
        var effectiveMaxLon = east ?? maxLon;
        if (effectiveMinLat is null || effectiveMaxLat is null || effectiveMinLon is null || effectiveMaxLon is null)
        {
            return BadRequest("Bounds are required.");
        }

        if (effectiveMinLat > effectiveMaxLat || effectiveMinLon > effectiveMaxLon ||
            effectiveMinLat is < -90 or > 90 || effectiveMaxLat is < -90 or > 90 ||
            effectiveMinLon is < -180 or > 180 || effectiveMaxLon is < -180 or > 180)
        {
            return BadRequest("Invalid bounds.");
        }

        limit = Math.Clamp(limit, 1, 250);
        var postsTask = _postQueryService.GetBoundsAsync(
            new BoundsQuery(effectiveMinLat.Value, effectiveMinLon.Value, effectiveMaxLat.Value, effectiveMaxLon.Value, 12, sinceMinutes, 1, limit),
            ct);
        var placesTask = GetPlacesAsync(effectiveMinLat.Value, effectiveMinLon.Value, effectiveMaxLat.Value, effectiveMaxLon.Value, limit, ct);

        await Task.WhenAll(postsTask, placesTask);

        var signals = postsTask.Result.Items
            .Where(post => post.PlaceId is null && post.Latitude.HasValue && post.Longitude.HasValue && post.IsLive)
            .Take(limit)
            .Select(ToSignalItem)
            .ToArray();
        var places = placesTask.Result
            .Where(p => p.CurrentState?.ActiveSignalCount > 0)
            .Take(limit)
            .ToArray();

        _logger.LogInformation("[Blinkr Map] Places: {Places} Signals: {Signals}", places.Length, signals.Length);
        return Ok(new UnifiedMapResponse(places, signals));
    }

    [HttpGet("nearby")]
    [Authorize]
    public async Task<IActionResult> GetNearby(
        [FromQuery] double lat,
        [FromQuery] double lon,
        [FromQuery] int radiusMeters = 3000,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken cancellationToken = default)
    {
        var query = new NearbyQuery
        {
            Lat = lat,
            Lon = lon,
            RadiusMeters = radiusMeters,
            Page = page,
            PageSize = pageSize
        };

        return Ok(await _postQueryService.GetNearbyAsync(query, cancellationToken));
    }

    private async Task<IReadOnlyList<PlaceMapItem>> GetPlacesAsync(double minLat, double minLon, double maxLat, double maxLon, int limit, CancellationToken ct)
    {
        var baseUrl = _configuration["PlaceService:BaseUrl"] ?? "http://localhost:5225";
        var client = _httpClientFactory.CreateClient();
        client.BaseAddress = new Uri(baseUrl);
        var url = string.Create(CultureInfo.InvariantCulture,
            $"/api/places/bounds?minLat={minLat:R}&minLon={minLon:R}&maxLat={maxLat:R}&maxLon={maxLon:R}&limit={limit}");
        try
        {
            var places = await client.GetFromJsonAsync<IReadOnlyList<PlaceMapItem>>(url, ct);
            return places ?? Array.Empty<PlaceMapItem>();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "PlaceService map composition failed.");
            return Array.Empty<PlaceMapItem>();
        }
    }

    private static SignalMapItem ToSignalItem(PostListDto post)
    {
        var mediaUrl = post.MediaUrls.FirstOrDefault();
        return new SignalMapItem(
            post.Id,
            post.Title,
            post.ContentPreview,
            post.Latitude!.Value,
            post.Longitude!.Value,
            post.SignalType,
            post.SignalValue,
            post.CreatedAtUtc,
            post.ExpiresAt,
            post.LocationName,
            mediaUrl,
            post.IdentityDisclosure == "AnonymousMap" ? "Topluluk üyesi" : post.AuthorName);
    }
}

public sealed record UnifiedMapResponse(
    IReadOnlyList<PlaceMapItem> Places,
    IReadOnlyList<SignalMapItem> Signals);

public sealed record PlaceMapItem(
    Guid Id,
    string Name,
    string Category,
    double Latitude,
    double Longitude,
    string? DisplayAddress,
    PlaceMapState? CurrentState);

public sealed record PlaceMapState(
    string? SignalType,
    string? SignalValue,
    string Freshness,
    DateTime? ObservedAtUtc,
    DateTime? ExpiresAtUtc,
    string Confidence,
    double ConfidenceValue,
    int ActiveSignalCount);

public sealed record SignalMapItem(
    Guid PostId,
    string Title,
    string TextPreview,
    double Latitude,
    double Longitude,
    string SignalType,
    string? SignalValue,
    DateTime CreatedAtUtc,
    DateTime? ExpiresAt,
    string? LocationName,
    string? MediaThumbnailUrl,
    string AuthorPreview);
