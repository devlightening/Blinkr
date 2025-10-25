using BlogService.Application.Services.Queries;
using BlogService.Application.DTOs.PostDtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace BlogService.Api.Controllers;

/// <summary>
/// Read-only endpoints for posts (queries)
/// </summary>
[ApiController]
[Route("api/posts-read")]
[Produces("application/json")]
[AllowAnonymous] // Read operations are public
public class PostsReadController : ControllerBase
{
    private readonly IPostQueryService _queryService;
    private readonly ILogger<PostsReadController> _logger;

    public PostsReadController(IPostQueryService queryService, ILogger<PostsReadController> logger)
    {
        _queryService = queryService;
        _logger = logger;
    }

    /// <summary>
    /// Get paginated list of posts with filtering and search
    /// </summary>
    /// <param name="page">Page number (1-based, default: 1)</param>
    /// <param name="pageSize">Items per page (1-100, default: 20)</param>
    /// <param name="authorId">Filter by author ID</param>
    /// <param name="q">Search in title and content</param>
    /// <param name="sort">Sort order: createdAt:desc, createdAt:asc, likeCount:desc (default: createdAt:desc)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Paginated list of posts</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<PostListDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any, VaryByQueryKeys = new[] { "page", "pageSize", "q", "authorId", "sort" })]
    public async Task<IActionResult> GetPosts(
        [FromQuery, Range(1, 1000)] int page = 1,
        [FromQuery, Range(1, 100)] int pageSize = 20,
        [FromQuery] string? authorId = null,
        [FromQuery] string? q = null,
        [FromQuery] string sort = "createdAt:desc",
        CancellationToken ct = default)
    {
        try
        {
            // Validate and clamp parameters
            page = Math.Clamp(page, 1, 1000);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = new PostQuery
            {
                Page = page,
                PageSize = pageSize,
                AuthorId = authorId,
                Search = q,
                Sort = sort
            };

            var result = await _queryService.QueryPostsAsync(query, ct);

            // Add pagination headers
            Response.Headers["X-Total-Count"] = result.Total.ToString();
            Response.Headers["X-Page"] = result.Page.ToString();
            Response.Headers["X-Page-Size"] = result.PageSize.ToString();
            Response.Headers["X-Total-Pages"] = result.TotalPages.ToString();
            Response.Headers["X-Has-Next"] = result.HasNext.ToString().ToLower();
            Response.Headers["X-Has-Previous"] = result.HasPrevious.ToString().ToLower();

            _logger.LogInformation("Posts query executed: Page={Page}, PageSize={PageSize}, Total={Total}, AuthorId={AuthorId}, Search={Search}",
                page, pageSize, result.Total, authorId, q);

            return Ok(result.Items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing posts query: Page={Page}, PageSize={PageSize}, AuthorId={AuthorId}, Search={Search}",
                page, pageSize, authorId, q);
            return StatusCode(500, "An error occurred while retrieving posts");
        }
    }

    /// <summary>
    /// Get a single post by ID
    /// </summary>
    /// <param name="id">Post ID</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Post details</returns>
    [HttpGet("{id:guid}")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any, VaryByQueryKeys = new[] { "id" })]
    [ProducesResponseType(typeof(PostListDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostListDto>> GetById(Guid id, CancellationToken ct = default)
    {
        try
        {
            var post = await _queryService.GetByIdAsync(id, ct);
            
            if (post == null)
            {
                _logger.LogWarning("Post not found: {PostId}", id);
                return NotFound($"Post with ID {id} not found");
            }

            _logger.LogInformation("Post retrieved: {PostId}", id);
            return Ok(post);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving post: {PostId}", id);
            return StatusCode(500, "An error occurred while retrieving the post");
        }
    }

    /// <summary>
    /// Get nearby posts within specified radius (geospatial query)
    /// </summary>
    /// <param name="lat">Latitude coordinate (-90 to 90)</param>
    /// <param name="lon">Longitude coordinate (-180 to 180)</param>
    /// <param name="radius">Search radius in meters (50 to 50,000, default: 5000)</param>
    /// <param name="page">Page number (1-based, default: 1)</param>
    /// <param name="pageSize">Items per page (1 to 50, default: 20)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Nearby posts ordered by distance</returns>
    [HttpGet("nearby")]
    [AllowAnonymous]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any, VaryByQueryKeys = new[] { "lat", "lon", "radius", "page", "pageSize" })]
    [ProducesResponseType(typeof(PagedResult<PostListDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PagedResult<PostListDto>>> GetNearby(
        [FromQuery(Name = "lat")] string latStr,
        [FromQuery(Name = "lon")] string lonStr,
        [FromQuery] int radius = 5000,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        try
        {
            // Parse coordinates with invariant culture
            if (!double.TryParse(latStr, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out double lat))
            {
                _logger.LogWarning("❌ Invalid latitude format: {LatStr}", latStr);
                return BadRequest($"Invalid latitude format: {latStr}");
            }
            
            if (!double.TryParse(lonStr, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out double lon))
            {
                _logger.LogWarning("❌ Invalid longitude format: {LonStr}", lonStr);
                return BadRequest($"Invalid longitude format: {lonStr}");
            }
            
            // Validate coordinates
            _logger.LogInformation("🔍 Parsed coordinates: lat={Lat}, lon={Lon}, radius={Radius}", lat, lon, radius);
            
            if (lat is < -90 or > 90 || lon is < -180 or > 180)
            {
                _logger.LogWarning("❌ Invalid coordinates provided: lat={Lat}, lon={Lon}", lat, lon);
                return BadRequest("Invalid latitude/longitude. Latitude must be between -90 and 90, longitude between -180 and 180.");
            }
            
            _logger.LogInformation("✅ Coordinates validated successfully");

            var query = new NearbyQuery(lat, lon, radius, page, pageSize);
            var result = await _queryService.GetNearbyAsync(query, ct);

            // Avoid double enumeration - use ICollection if available
            var hits = result.Items is ICollection<PostListDto> c ? c.Count : result.Items.Count();
            _logger.LogInformation(
                "📍 Nearby posts retrieved: lat={Lat}, lon={Lon}, radius={Radius}m, page={Page}/{PageSize}, hits={Hits}",
                lat, lon, radius, page, pageSize, hits);

            return Ok(result);
        }
        catch (ArgumentOutOfRangeException ex)
        {
            _logger.LogWarning(ex, "Invalid query parameters for nearby search");
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving nearby posts: latStr={LatStr}, lonStr={LonStr}, radius={Radius}m", latStr, lonStr, radius);
            return StatusCode(500, "An error occurred while retrieving nearby posts");
        }
    }

    /// <summary>
    /// Get posts by author
    /// </summary>
    /// <param name="authorId">Author ID</param>
    /// <param name="page">Page number (1-based, default: 1)</param>
    /// <param name="pageSize">Items per page (1-100, default: 20)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Paginated list of author's posts</returns>
    [HttpGet("author/{authorId:guid}")]
    [ProducesResponseType(typeof(IEnumerable<PostListDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetByAuthor(
        Guid authorId,
        [FromQuery, Range(1, 1000)] int page = 1,
        [FromQuery, Range(1, 100)] int pageSize = 20,
        CancellationToken ct = default)
    {
        try
        {
            // Use the main query method with author filter
            var query = new PostQuery
            {
                Page = page,
                PageSize = pageSize,
                AuthorId = authorId.ToString(),
                Sort = "createdAt:desc"
            };

            var result = await _queryService.QueryPostsAsync(query, ct);

            // Add pagination headers
            Response.Headers["X-Total-Count"] = result.Total.ToString();
            Response.Headers["X-Page"] = result.Page.ToString();
            Response.Headers["X-Page-Size"] = result.PageSize.ToString();
            Response.Headers["X-Total-Pages"] = result.TotalPages.ToString();

            _logger.LogInformation("Author posts query executed: AuthorId={AuthorId}, Page={Page}, Total={Total}",
                authorId, page, result.Total);

            return Ok(result.Items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving posts for author: {AuthorId}", authorId);
            return StatusCode(500, "An error occurred while retrieving author posts");
        }
    }
}
