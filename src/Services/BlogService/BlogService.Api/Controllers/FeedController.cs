using BlogService.Application.Services.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BlogService.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize(Policy = "api.read")]
public class FeedController : ControllerBase
{
    private readonly IPostQueryService _postQueryService;
    private readonly ILogger<FeedController> _logger;

    public FeedController(IPostQueryService postQueryService, ILogger<FeedController> logger)
    {
        _postQueryService = postQueryService;
        _logger = logger;
    }

    /// <summary>
    /// Get feed posts with sorting and pagination
    /// </summary>
    /// <param name="sort">Sort type: nearby, popular, new</param>
    /// <param name="page">Page number (1-based)</param>
    /// <param name="pageSize">Items per page (max 50)</param>
    /// <param name="lat">User latitude for nearby sorting</param>
    /// <param name="lon">User longitude for nearby sorting</param>
    /// <returns>Feed posts</returns>
    [HttpGet]
    [EnableRateLimiting("feed")]
    [ResponseCache(Duration = 60, VaryByQueryKeys = new[] { "sort", "page", "pageSize", "lat", "lon" })]
    public async Task<IActionResult> GetFeed(
        [FromQuery] string sort = "nearby",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] double? lat = null,
        [FromQuery] double? lon = null)
    {
        try
        {
            // Validate parameters
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 15;
            if (pageSize > 50) pageSize = 50; // Prevent abuse

            var validSortTypes = new[] { "nearby", "popular", "new" };
            if (!validSortTypes.Contains(sort.ToLower()))
            {
                sort = "nearby";
            }

            // For nearby sort, require coordinates
            if (sort.ToLower() == "nearby" && (!lat.HasValue || !lon.HasValue))
            {
                return BadRequest(new { 
                    error = "Coordinates required for nearby sorting",
                    message = "Yakın sıralama için konum bilgisi gerekli"
                });
            }

            var deviceId = HttpContext.Items["DeviceId"]?.ToString() ?? "unknown";
            
            _logger.LogInformation("Feed request: sort={Sort}, page={Page}, pageSize={PageSize}, lat={Lat}, lon={Lon}, device={DeviceId}",
                sort, page, pageSize, lat, lon, deviceId);

            var result = await GetFeedData(sort, page, pageSize, lat, lon);

            return Ok(new
            {
                items = result.Items,
                pagination = new
                {
                    currentPage = page,
                    pageSize = pageSize,
                    totalCount = result.TotalCount,
                    hasMore = result.HasMore,
                    totalPages = (int)Math.Ceiling((double)result.TotalCount / pageSize)
                },
                sort = sort,
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting feed: sort={Sort}, page={Page}", sort, page);
            return StatusCode(500, new { 
                error = "Internal server error",
                message = "Akış yüklenirken hata oluştu"
            });
        }
    }

    private async Task<(IEnumerable<object> Items, int TotalCount, bool HasMore)> GetFeedData(
        string sort, int page, int pageSize, double? lat, double? lon)
    {
        return sort.ToLower() switch
        {
            "nearby" when lat.HasValue && lon.HasValue => 
                await GetNearbyFeed(lat.Value, lon.Value, page, pageSize),
            "popular" => 
                await GetPopularFeed(page, pageSize),
            "new" => 
                await GetNewFeed(page, pageSize),
            _ => 
                await GetNewFeed(page, pageSize) // Default fallback
        };
    }

    private async Task<(IEnumerable<object> Items, int TotalCount, bool HasMore)> GetNearbyFeed(
        double lat, double lon, int page, int pageSize)
    {
        var radiusMeters = 10000; // 10km default radius
        var posts = await _postQueryService.GetNearbyPostsAsync(lat, lon, radiusMeters, page, pageSize);
        
        var items = posts.Select(p => new
        {
            id = p.Id,
            title = p.Title,
            content = p.Content?.Length > 150 ? p.Content[..150] + "..." : p.Content,
            authorName = p.AuthorName,
            createdAt = p.CreatedAt,
            likeCount = p.LikeCount,
            commentCount = p.CommentCount,
            distanceMeters = p.DistanceMeters,
            locationName = p.LocationName,
            mediaPreview = p.MediaUrls?.FirstOrDefault(), // First image as preview
            location = p.Location != null ? new
            {
                lat = ((dynamic)p.Location).Coordinates?[1], // GeoJSON format: [lon, lat]
                lon = ((dynamic)p.Location).Coordinates?[0]
            } : null
        });

        var totalCount = await _postQueryService.GetNearbyPostsCountAsync(lat, lon, radiusMeters);
        var hasMore = (page * pageSize) < totalCount;

        return (items, totalCount, hasMore);
    }

    private async Task<(IEnumerable<object> Items, int TotalCount, bool HasMore)> GetPopularFeed(
        int page, int pageSize)
    {
        // Get posts sorted by engagement (likes + comments) in last 7 days
        var posts = await _postQueryService.GetPopularPostsAsync(page, pageSize, TimeSpan.FromDays(7));
        
        var items = posts.Select(p => new
        {
            id = p.Id,
            title = p.Title,
            content = p.Content?.Length > 150 ? p.Content[..150] + "..." : p.Content,
            authorName = p.AuthorName,
            createdAt = p.CreatedAt,
            likeCount = p.LikeCount,
            commentCount = p.CommentCount,
            engagementScore = p.LikeCount + p.CommentCount,
            locationName = p.LocationName,
            mediaPreview = p.MediaUrls?.FirstOrDefault(),
            location = p.Location != null ? new
            {
                lat = ((dynamic)p.Location).Coordinates?[1],
                lon = ((dynamic)p.Location).Coordinates?[0]
            } : null
        });

        var totalCount = await _postQueryService.GetTotalPostsCountAsync();
        var hasMore = (page * pageSize) < totalCount;

        return (items, totalCount, hasMore);
    }

    private async Task<(IEnumerable<object> Items, int TotalCount, bool HasMore)> GetNewFeed(
        int page, int pageSize)
    {
        // Get latest posts
        var posts = await _postQueryService.GetLatestPostsAsync(page, pageSize);
        
        var items = posts.Select(p => new
        {
            id = p.Id,
            title = p.Title,
            content = p.Content?.Length > 150 ? p.Content[..150] + "..." : p.Content,
            authorName = p.AuthorName,
            createdAt = p.CreatedAt,
            likeCount = p.LikeCount,
            commentCount = p.CommentCount,
            locationName = p.LocationName,
            mediaPreview = p.MediaUrls?.FirstOrDefault(),
            location = p.Location != null ? new
            {
                lat = ((dynamic)p.Location).Coordinates?[1],
                lon = ((dynamic)p.Location).Coordinates?[0]
            } : null
        });

        var totalCount = await _postQueryService.GetTotalPostsCountAsync();
        var hasMore = (page * pageSize) < totalCount;

        return (items, totalCount, hasMore);
    }
}
