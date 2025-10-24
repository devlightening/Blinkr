using BlogService.Api.DTOs;
using BlogService.Application.DTOs.PostDtos;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;

namespace BlogService.Api.Services;

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
}
