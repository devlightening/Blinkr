using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Services.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogService.Api.Controllers;

/// <summary>
/// Map endpoints for geospatial post queries
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MapController : ControllerBase
{
    private readonly IPostQueryService _postQueryService;
    private readonly ILogger<MapController> _logger;

    public MapController(
        IPostQueryService postQueryService,
        ILogger<MapController> logger)
    {
        _postQueryService = postQueryService;
        _logger = logger;
    }

    /// <summary>
    /// WS-11B: Get nearby posts for map display
    /// Returns posts within specified radius from coordinates
    /// </summary>
    [HttpGet("nearby")]
    public async Task<IActionResult> GetNearby(
        [FromQuery] double lat,
        [FromQuery] double lon,
        [FromQuery] int radiusMeters = 3000,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("WS-11B: Map nearby query - Lat={Lat}, Lon={Lon}, Radius={Radius}m, Page={Page}", 
                lat, lon, radiusMeters, page);

            var query = new NearbyQuery
            {
                Lat = lat,
                Lon = lon,
                RadiusMeters = radiusMeters,
                Page = page,
                PageSize = pageSize
            };

            var result = await _postQueryService.GetNearbyAsync(query, cancellationToken);

            _logger.LogInformation("WS-11B: Returned {Count} posts from {Total} total", 
                result.Items.Count(), result.Total);

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WS-11B: Error getting nearby posts");
            return StatusCode(500, new { error = "Error retrieving nearby posts", message = ex.Message });
        }
    }
}
