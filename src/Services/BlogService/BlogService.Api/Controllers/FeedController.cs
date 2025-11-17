using BlogService.Application.Services.Queries;
using BlogService.Application.DTOs.PostDtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MongoDB.Driver;
using BlogService.Infrastructure.ReadModels;

namespace BlogService.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize(Policy = "api.read")]
public class FeedController : ControllerBase
{
    private readonly IPostQueryService _postQueryService;
    private readonly ILogger<FeedController> _logger;
    private readonly IMongoDatabase _mongoDb;

    public FeedController(
        IPostQueryService postQueryService, 
        ILogger<FeedController> logger,
        IMongoDatabase mongoDb)
    {
        _postQueryService = postQueryService;
        _logger = logger;
        _mongoDb = mongoDb;
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
    
    /// <summary>
    /// Get NOW feed - fresh posts from last 180 minutes with decay-based ranking
    /// </summary>
    /// <param name="lat">User latitude</param>
    /// <param name="lon">User longitude</param>
    /// <param name="radiusKm">Search radius in kilometers (default: 2km)</param>
    /// <param name="sinceMinutes">Time window in minutes (default: 180 = 3 hours)</param>
    /// <param name="page">Page number</param>
    /// <param name="pageSize">Items per page</param>
    /// <param name="category">Optional category filter</param>
    /// <returns>NOW feed with freshness metrics</returns>
    [HttpGet("now")]
    [EnableRateLimiting("feed")]
    [ResponseCache(Duration = 30, VaryByQueryKeys = new[] { "lat", "lon", "radiusKm", "sinceMinutes", "page", "category" })]
    public async Task<IActionResult> GetNowFeed(
        [FromQuery] double lat,
        [FromQuery] double lon,
        [FromQuery] double radiusKm = 2.0,
        [FromQuery] int sinceMinutes = 180,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? category = null)
    {
        try
        {
            // Validate parameters
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 20;
            if (pageSize > 50) pageSize = 50;
            if (radiusKm < 0.05) radiusKm = 0.05; // Min 50m
            if (radiusKm > 50) radiusKm = 50; // Max 50km
            if (sinceMinutes < 0) sinceMinutes = 0;
            if (sinceMinutes > 1440) sinceMinutes = 1440; // Max 24h

            var deviceId = HttpContext.Items["DeviceId"]?.ToString() ?? "unknown";
            
            _logger.LogInformation(
                "📍 NOW Feed request: lat={Lat}, lon={Lon}, radius={RadiusKm}km, sinceMin={SinceMin}, page={Page}, device={DeviceId}",
                lat, lon, radiusKm, sinceMinutes, page, deviceId);

            var query = new NearbyQuery(
                Lat: lat,
                Lon: lon,
                RadiusMeters: (int)(radiusKm * 1000),
                SinceMinutes: sinceMinutes,
                Category: category,
                Page: page,
                PageSize: pageSize
            );

            var result = await _postQueryService.GetNearbyAsync(query);

            return Ok(new
            {
                items = result.Items.Select(p => new
                {
                    id = p.Id,
                    title = p.Title,
                    content = p.ContentPreview,
                    authorName = p.AuthorName,
                    createdAt = p.CreatedAtUtc,
                    likeCount = p.LikeCount,
                    commentCount = p.CommentCount,
                    distanceMeters = p.DistanceMeters,
                    freshnessSec = p.FreshnessSec,
                    isLive = p.IsLive,
                    decayScore = p.DecayScore,
                    locationName = p.LocationName,
                    mediaPreview = p.MediaUrls?.FirstOrDefault(),
                    location = p.Latitude.HasValue && p.Longitude.HasValue ? new
                    {
                        lat = p.Latitude.Value,
                        lon = p.Longitude.Value
                    } : null
                }),
                pagination = new
                {
                    currentPage = page,
                    pageSize = pageSize,
                    totalCount = result.Total,
                    hasMore = (page * pageSize) < result.Total
                },
                filters = new
                {
                    radiusKm = radiusKm,
                    sinceMinutes = sinceMinutes,
                    category = category
                },
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting NOW feed: lat={Lat}, lon={Lon}", lat, lon);
            return StatusCode(500, new
            {
                error = "Internal server error",
                message = "NOW akışı yüklenirken hata oluştu"
            });
        }
    }
    
    /// <summary>
    /// Get heatmap of post density (geohash grid)
    /// </summary>
    /// <param name="lat">Center latitude</param>
    /// <param name="lon">Center longitude</param>
    /// <param name="radiusKm">Search radius in kilometers (default: 5km)</param>
    /// <param name="sinceMinutes">Time window in minutes (default: 180 = 3 hours)</param>
    /// <param name="precision">Geohash precision (4-6, default: 5)</param>
    /// <returns>Heatmap cells with post counts</returns>
    [HttpGet("heatmap")]
    [AllowAnonymous]
    [ResponseCache(Duration = 60, VaryByQueryKeys = new[] { "lat", "lon", "radiusKm", "sinceMinutes", "precision" })]
    public async Task<IActionResult> GetHeatmap(
        [FromQuery] double lat,
        [FromQuery] double lon,
        [FromQuery] double radiusKm = 5.0,
        [FromQuery] int sinceMinutes = 180,
        [FromQuery] int precision = 5)
    {
        try
        {
            // Validate parameters
            if (radiusKm < 0.1) radiusKm = 0.1;
            if (radiusKm > 50) radiusKm = 50;
            if (sinceMinutes < 0) sinceMinutes = 0;
            if (sinceMinutes > 1440) sinceMinutes = 1440;
            if (precision < 4) precision = 4;
            if (precision > 6) precision = 6;
            
            _logger.LogInformation(
                "🗺️ Heatmap request: lat={Lat}, lon={Lon}, radius={RadiusKm}km, sinceMin={SinceMin}, precision={Precision}",
                lat, lon, radiusKm, sinceMinutes, precision);
            
            var collection = _mongoDb.GetCollection<PostDocument>("posts");
            
            // Build aggregation pipeline
            var cutoffTime = DateTime.UtcNow.AddMinutes(-sinceMinutes);
            var radiusMeters = radiusKm * 1000;
            
            var pipeline = new MongoDB.Bson.BsonDocument[]
            {
                // Filter by location proximity and time
                new("$geoNear", new MongoDB.Bson.BsonDocument
                {
                    ["near"] = new MongoDB.Bson.BsonDocument
                    {
                        ["type"] = "Point",
                        ["coordinates"] = new MongoDB.Bson.BsonArray { lon, lat }
                    },
                    ["distanceField"] = "distance",
                    ["maxDistance"] = radiusMeters,
                    ["spherical"] = true,
                    ["query"] = new MongoDB.Bson.BsonDocument
                    {
                        ["CreatedAtUtc"] = new MongoDB.Bson.BsonDocument("$gte", cutoffTime)
                    }
                }),
                // Calculate geohash for grouping
                new("$addFields", new MongoDB.Bson.BsonDocument
                {
                    ["geohash"] = new MongoDB.Bson.BsonDocument("$function", new MongoDB.Bson.BsonDocument
                    {
                        ["body"] = $@"
                            function(coords, precision) {{
                                // Simple geohash implementation
                                const lat = coords[1];
                                const lon = coords[0];
                                const latRange = [-90, 90];
                                const lonRange = [-180, 180];
                                let hash = '';
                                let isEven = true;
                                const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
                                
                                for (let i = 0; i < precision; i++) {{
                                    let idx = 0;
                                    for (let bit = 0; bit < 5; bit++) {{
                                        if (isEven) {{
                                            const mid = (lonRange[0] + lonRange[1]) / 2;
                                            if (lon > mid) {{
                                                idx |= (1 << (4 - bit));
                                                lonRange[0] = mid;
                                            }} else {{
                                                lonRange[1] = mid;
                                            }}
                                        }} else {{
                                            const mid = (latRange[0] + latRange[1]) / 2;
                                            if (lat > mid) {{
                                                idx |= (1 << (4 - bit));
                                                latRange[0] = mid;
                                            }} else {{
                                                latRange[1] = mid;
                                            }}
                                        }}
                                        isEven = !isEven;
                                    }}
                                    hash += base32[idx];
                                }}
                                return hash;
                            }}
                        ",
                        ["args"] = new MongoDB.Bson.BsonArray 
                        { 
                            "$Location.coordinates", 
                            precision 
                        },
                        ["lang"] = "js"
                    })
                }),
                // Group by geohash
                new("$group", new MongoDB.Bson.BsonDocument
                {
                    ["_id"] = "$geohash",
                    ["count"] = new MongoDB.Bson.BsonDocument("$sum", 1),
                    ["maxFreshnessSec"] = new MongoDB.Bson.BsonDocument("$max", 
                        new MongoDB.Bson.BsonDocument("$divide", new MongoDB.Bson.BsonArray
                        {
                            new MongoDB.Bson.BsonDocument("$subtract", new MongoDB.Bson.BsonArray { "$$NOW", "$CreatedAtUtc" }),
                            1000
                        }))
                }),
                // Sort by count descending
                new("$sort", new MongoDB.Bson.BsonDocument("count", -1)),
                // Limit to top 100 cells
                new("$limit", 100)
            };
            
            var results = await collection.Aggregate<MongoDB.Bson.BsonDocument>(pipeline).ToListAsync();
            
            var cells = results.Select(doc => new
            {
                geohash = doc.GetValue("_id", "").AsString,
                count = doc.GetValue("count", 0).ToInt32(),
                maxFreshnessSec = doc.GetValue("maxFreshnessSec", 0).ToInt32()
            }).ToList();
            
            _logger.LogInformation("🗺️ Heatmap generated: {CellCount} cells, total posts: {TotalPosts}",
                cells.Count, cells.Sum(c => c.count));
            
            return Ok(new
            {
                cells = cells,
                filters = new
                {
                    center = new { lat, lon },
                    radiusKm = radiusKm,
                    sinceMinutes = sinceMinutes,
                    precision = precision
                },
                updatedAt = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating heatmap");
            return StatusCode(500, new
            {
                error = "Internal server error",
                message = "Heatmap oluşturulurken hata oluştu"
            });
        }
    }
}
