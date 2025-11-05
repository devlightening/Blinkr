using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using PostService.Application.DTOs;
using PostService.Domain.Entities;
using PostService.Infrastructure.Data;
using System.Security.Claims;

namespace PostService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostsController : ControllerBase
{
    private readonly PostServiceDbContext _context;
    private readonly ILogger<PostsController> _logger;

    public PostsController(PostServiceDbContext context, ILogger<PostsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/posts/nearby - Get posts near a location
    /// </summary>
    [HttpGet("nearby")]
    [ProducesResponseType(typeof(List<PostLocationDto>), 200)]
    public async Task<IActionResult> GetNearby(
        [FromQuery] double lat,
        [FromQuery] double lng,
        [FromQuery] double radiusKm = 5.0)
    {
        try
        {
            // Create point for search center (SRID 4326 = WGS84)
            var geometryFactory = NetTopologySuite.NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
            var searchPoint = geometryFactory.CreatePoint(new Coordinate(lng, lat));

            // Query posts within radius using PostGIS ST_DWithin
            // ST_DWithin uses meters for geography type
            var radiusMeters = radiusKm * 1000;

            var posts = await _context.Posts
                .Where(p => p.Location != null && 
                           p.Location.IsWithinDistance(searchPoint, radiusMeters))
                .OrderBy(p => p.Location!.Distance(searchPoint))
                .Take(100) // Limit results
                .Select(p => new PostLocationDto(
                    p.Id,
                    p.Title,
                    p.Location!.Y, // Latitude
                    p.Location!.X, // Longitude
                    p.MediaUrl
                ))
                .ToListAsync();

            _logger.LogInformation(
                "📍 Nearby query: lat={Lat}, lng={Lng}, radius={Radius}km, found={Count} posts",
                lat, lng, radiusKm, posts.Count);

            return Ok(posts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error in nearby query");
            return StatusCode(500, new { error = "Failed to fetch nearby posts" });
        }
    }

    /// <summary>
    /// POST /api/posts - Create a new post
    /// </summary>
    [HttpPost]
    [Authorize]
    [ProducesResponseType(typeof(Post), 201)]
    public async Task<IActionResult> Create([FromBody] CreatePostRequest request)
    {
        try
        {
            // Get userId from JWT token
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized("Invalid token");
            }

            // Create PostGIS Point
            var geometryFactory = NetTopologySuite.NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
            var location = geometryFactory.CreatePoint(new Coordinate(request.Lng, request.Lat));

            var post = new Post
            {
                UserId = userId,
                Title = request.Title,
                Content = request.Content,
                MediaUrl = request.MediaUrl,
                Location = location,
                Visibility = request.Visibility ?? "Public"
            };

            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "✅ Post created: Id={PostId}, UserId={UserId}, Location=({Lat},{Lng})",
                post.Id, userId, request.Lat, request.Lng);

            return CreatedAtAction(nameof(GetById), new { id = post.Id }, post);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error creating post");
            return StatusCode(500, new { error = "Failed to create post" });
        }
    }

    /// <summary>
    /// GET /api/posts/{id} - Get post by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(Post), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var post = await _context.Posts.FindAsync(id);
        if (post == null)
            return NotFound();

        return Ok(post);
    }
}

/// <summary>
/// Request DTO for creating a post
/// </summary>
public record CreatePostRequest(
    string Title,
    double Lat,
    double Lng,
    string? Content = null,
    string? MediaUrl = null,
    string? Visibility = "Public"
);
