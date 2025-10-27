using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Services.Queries;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace BlogService.Infrastructure.Services;

/// <summary>
/// Cached wrapper for PostQueryService using Redis
/// </summary>
public class CachedPostQueryService : IPostQueryService
{
    private readonly IPostQueryService _inner;
    private readonly IDistributedCache _cache;
    private readonly ILogger<CachedPostQueryService> _logger;

    // Cache settings
    private static readonly TimeSpan PostDetailCacheDuration = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan PostListCacheDuration = TimeSpan.FromMinutes(5);
    
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public CachedPostQueryService(
        IPostQueryService inner, 
        IDistributedCache cache, 
        ILogger<CachedPostQueryService> logger)
    {
        _inner = inner;
        _cache = cache;
        _logger = logger;
    }

    public async Task<PostReadDto?> GetPostByIdAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        return await GetByIdAsync(postId, cancellationToken);
    }

    public async Task<PostReadDto?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var cacheKey = $"post:detail:{postId}";
        
        try
        {
            // Try cache first
            var cached = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cached))
            {
                var cachedPost = JsonSerializer.Deserialize<PostReadDto>(cached, JsonOptions);
                if (cachedPost != null)
                {
                    _logger.LogDebug("Cache HIT for post detail: {PostId}", postId);
                    return cachedPost;
                }
            }

            _logger.LogDebug("Cache MISS for post detail: {PostId}", postId);

            // Get from database
            var post = await _inner.GetByIdAsync(postId, cancellationToken);
            
            if (post != null)
            {
                // Cache the result
                var serialized = JsonSerializer.Serialize(post, JsonOptions);
                var cacheOptions = new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = PostDetailCacheDuration
                };
                
                await _cache.SetStringAsync(cacheKey, serialized, cacheOptions, cancellationToken);
                _logger.LogDebug("Cached post detail: {PostId} for {Duration}", postId, PostDetailCacheDuration);
            }

            return post;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for post {PostId}, falling back to database", postId);
            return await _inner.GetByIdAsync(postId, cancellationToken);
        }
    }

    public async Task<PagedResult<PostListDto>> QueryPostsAsync(PostQuery query, CancellationToken cancellationToken = default)
    {
        // Only cache first page of simple queries (no search, no author filter)
        var shouldCache = query.Page == 1 && 
                         query.PageSize <= 20 && 
                         string.IsNullOrEmpty(query.Search) && 
                         string.IsNullOrEmpty(query.AuthorId) &&
                         query.Sort == "createdAt:desc";

        if (!shouldCache)
        {
            _logger.LogDebug("Skipping cache for complex query: {@Query}", query);
            return await _inner.QueryPostsAsync(query, cancellationToken);
        }

        var cacheKey = $"posts:feed:page:{query.Page}:size:{query.PageSize}:sort:{query.Sort}";
        
        try
        {
            // Try cache first
            var cached = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cached))
            {
                var cachedResult = JsonSerializer.Deserialize<PagedResult<PostListDto>>(cached, JsonOptions);
                if (cachedResult != null)
                {
                    _logger.LogDebug("Cache HIT for posts feed: {CacheKey}", cacheKey);
                    return cachedResult;
                }
            }

            _logger.LogDebug("Cache MISS for posts feed: {CacheKey}", cacheKey);

            // Get from database
            var result = await _inner.QueryPostsAsync(query, cancellationToken);
            
            // Cache the result
            var serialized = JsonSerializer.Serialize(result, JsonOptions);
            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = PostListCacheDuration
            };
            
            await _cache.SetStringAsync(cacheKey, serialized, cacheOptions, cancellationToken);
            _logger.LogDebug("Cached posts feed: {CacheKey} for {Duration}", cacheKey, PostListCacheDuration);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for posts query, falling back to database: {@Query}", query);
            return await _inner.QueryPostsAsync(query, cancellationToken);
        }
    }

    // Delegate other methods to inner service (no caching for now)
    public Task<PaginatedResult<PostReadDto>> GetFeedAsync(int page, int pageSize, CancellationToken cancellationToken = default)
        => _inner.GetFeedAsync(page, pageSize, cancellationToken);

    public Task<PaginatedResult<PostReadDto>> GetUserPostsAsync(Guid authorId, int page, int pageSize, CancellationToken cancellationToken = default)
        => _inner.GetUserPostsAsync(authorId, page, pageSize, cancellationToken);

    public Task<bool> PostExistsAsync(Guid postId, CancellationToken cancellationToken = default)
        => _inner.PostExistsAsync(postId, cancellationToken);

    /// <summary>
    /// Invalidate cache for a specific post (call this when post is updated)
    /// </summary>
    public async Task InvalidatePostCacheAsync(Guid postId)
    {
        try
        {
            var cacheKey = $"post:detail:{postId}";
            await _cache.RemoveAsync(cacheKey);
            
            // Also invalidate feed cache (simple approach - remove first page)
            var feedCacheKey = "posts:feed:page:1:size:20:sort:createdAt:desc";
            await _cache.RemoveAsync(feedCacheKey);
            
            _logger.LogDebug("Invalidated cache for post: {PostId}", postId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error invalidating cache for post: {PostId}", postId);
        }
    }

    public async Task<PagedResult<PostListDto>> GetNearbyAsync(NearbyQuery query, CancellationToken cancellationToken = default)
    {
        // Round lat/lon to prevent cache key explosion (~1m precision)
        static double Round(double v) => Math.Round(v, 5, MidpointRounding.AwayFromZero);

        var q = query.Clamp();
        var latR = Round(q.Lat);
        var lonR = Round(q.Lon);

        var key = $"nearby:{latR}:{lonR}:{q.RadiusMeters}:{q.Page}:{q.PageSize}";
        
        try
        {
            // Try cache first
            var cached = await GetFromCacheAsync<PagedResult<PostListDto>>(key, cancellationToken);
            if (cached is not null) 
            {
                _logger.LogDebug("📍 Cache HIT for nearby query: {Key}", key);
                return cached;
            }

            // Cache miss - fetch from inner service
            _logger.LogDebug("📍 Cache MISS for nearby query: {Key}", key);
            var result = await _inner.GetNearbyAsync(q, cancellationToken);
            
            // Cache for 60 seconds (short TTL for location data)
            await SetCacheAsync(key, result, TimeSpan.FromSeconds(60), cancellationToken);
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for nearby query, falling back to direct call");
            return await _inner.GetNearbyAsync(q, cancellationToken);
        }
    }

    // FEED API METHODS - Delegate to inner service with basic caching
    public async Task<IEnumerable<PostListDto>> GetNearbyPostsAsync(double lat, double lon, int radiusMeters, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var cacheKey = $"nearby:feed:{lat:F5}:{lon:F5}:{radiusMeters}:{page}:{pageSize}";
        
        try
        {
            var cached = await GetFromCacheAsync<IEnumerable<PostListDto>>(cacheKey, cancellationToken);
            if (cached is not null)
            {
                _logger.LogDebug("Cache HIT for nearby posts feed: {CacheKey}", cacheKey);
                return cached;
            }

            _logger.LogDebug("Cache MISS for nearby posts feed: {CacheKey}", cacheKey);
            var result = await _inner.GetNearbyPostsAsync(lat, lon, radiusMeters, page, pageSize, cancellationToken);
            
            // Cache for 2 minutes
            await SetCacheAsync(cacheKey, result, TimeSpan.FromMinutes(2), cancellationToken);
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for nearby posts feed, falling back to database");
            return await _inner.GetNearbyPostsAsync(lat, lon, radiusMeters, page, pageSize, cancellationToken);
        }
    }

    public async Task<int> GetNearbyPostsCountAsync(double lat, double lon, int radiusMeters, CancellationToken cancellationToken = default)
    {
        var cacheKey = $"nearby:count:{lat:F5}:{lon:F5}:{radiusMeters}";
        
        try
        {
            var cached = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cached) && int.TryParse(cached, out var count))
            {
                _logger.LogDebug("Cache HIT for nearby posts count: {CacheKey}", cacheKey);
                return count;
            }

            _logger.LogDebug("Cache MISS for nearby posts count: {CacheKey}", cacheKey);
            var result = await _inner.GetNearbyPostsCountAsync(lat, lon, radiusMeters, cancellationToken);
            
            // Cache for 5 minutes
            await _cache.SetStringAsync(cacheKey, result.ToString(), new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
            }, cancellationToken);
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for nearby posts count, falling back to database");
            return await _inner.GetNearbyPostsCountAsync(lat, lon, radiusMeters, cancellationToken);
        }
    }

    public async Task<IEnumerable<PostListDto>> GetPopularPostsAsync(int page, int pageSize, TimeSpan timeWindow, CancellationToken cancellationToken = default)
    {
        var cacheKey = $"popular:feed:{page}:{pageSize}:{timeWindow.TotalHours:F0}h";
        
        try
        {
            var cached = await GetFromCacheAsync<IEnumerable<PostListDto>>(cacheKey, cancellationToken);
            if (cached is not null)
            {
                _logger.LogDebug("Cache HIT for popular posts feed: {CacheKey}", cacheKey);
                return cached;
            }

            _logger.LogDebug("Cache MISS for popular posts feed: {CacheKey}", cacheKey);
            var result = await _inner.GetPopularPostsAsync(page, pageSize, timeWindow, cancellationToken);
            
            // Cache for 10 minutes
            await SetCacheAsync(cacheKey, result, TimeSpan.FromMinutes(10), cancellationToken);
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for popular posts feed, falling back to database");
            return await _inner.GetPopularPostsAsync(page, pageSize, timeWindow, cancellationToken);
        }
    }

    public async Task<IEnumerable<PostListDto>> GetLatestPostsAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var cacheKey = $"latest:feed:{page}:{pageSize}";
        
        try
        {
            var cached = await GetFromCacheAsync<IEnumerable<PostListDto>>(cacheKey, cancellationToken);
            if (cached is not null)
            {
                _logger.LogDebug("Cache HIT for latest posts feed: {CacheKey}", cacheKey);
                return cached;
            }

            _logger.LogDebug("Cache MISS for latest posts feed: {CacheKey}", cacheKey);
            var result = await _inner.GetLatestPostsAsync(page, pageSize, cancellationToken);
            
            // Cache for 5 minutes
            await SetCacheAsync(cacheKey, result, TimeSpan.FromMinutes(5), cancellationToken);
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for latest posts feed, falling back to database");
            return await _inner.GetLatestPostsAsync(page, pageSize, cancellationToken);
        }
    }

    public async Task<int> GetTotalPostsCountAsync(CancellationToken cancellationToken = default)
    {
        const string cacheKey = "posts:total:count";
        
        try
        {
            var cached = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cached) && int.TryParse(cached, out var count))
            {
                _logger.LogDebug("Cache HIT for total posts count");
                return count;
            }

            _logger.LogDebug("Cache MISS for total posts count");
            var result = await _inner.GetTotalPostsCountAsync(cancellationToken);
            
            // Cache for 30 minutes
            await _cache.SetStringAsync(cacheKey, result.ToString(), new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30)
            }, cancellationToken);
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for total posts count, falling back to database");
            return await _inner.GetTotalPostsCountAsync(cancellationToken);
        }
    }

    // Helper methods for cache operations
    private async Task<T?> GetFromCacheAsync<T>(string key, CancellationToken cancellationToken) where T : class
    {
        try
        {
            var cached = await _cache.GetStringAsync(key, cancellationToken);
            if (!string.IsNullOrEmpty(cached))
            {
                return JsonSerializer.Deserialize<T>(cached, JsonOptions);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error reading from cache for key: {Key}", key);
        }
        return null;
    }

    private async Task SetCacheAsync<T>(string key, T value, TimeSpan expiration, CancellationToken cancellationToken)
    {
        try
        {
            var serialized = JsonSerializer.Serialize(value, JsonOptions);
            var options = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = expiration
            };
            await _cache.SetStringAsync(key, serialized, options, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error writing to cache for key: {Key}", key);
        }
    }
}
