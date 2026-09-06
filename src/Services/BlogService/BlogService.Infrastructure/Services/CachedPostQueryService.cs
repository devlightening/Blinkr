using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Services.Queries;
using BlogService.Infrastructure.ReadModels;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace BlogService.Infrastructure.Services;

/// <summary>
/// Cached wrapper for PostQueryService using Redis
/// </summary>
public class CachedPostQueryService : IPostQueryService
{
    private readonly IMongoDatabase _mongoDb;
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
         IMongoDatabase mongoDb,
         IDistributedCache cache,
         ILogger<CachedPostQueryService> logger)
    {
        _mongoDb = mongoDb ?? throw new ArgumentNullException(nameof(mongoDb));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
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
            var collection = _mongoDb.GetCollection<PostDocument>("posts");
            var doc = await collection.Find(p => p.Id == postId).FirstOrDefaultAsync(cancellationToken);
            
            if (doc != null)
            {
                var post = MapToReadDto(doc);
                // Cache the result
                var serialized = JsonSerializer.Serialize(post, JsonOptions);
                var cacheOptions = new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = PostDetailCacheDuration
                };
                
                await _cache.SetStringAsync(cacheKey, serialized, cacheOptions, cancellationToken);
                _logger.LogDebug("Cached post detail: {PostId} for {Duration}", postId, PostDetailCacheDuration);
                return post;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for post {PostId}, falling back to database", postId);
            var collection = _mongoDb.GetCollection<PostDocument>("posts");
            var doc = await collection.Find(p => p.Id == postId).FirstOrDefaultAsync(cancellationToken);
            return doc != null ? MapToReadDto(doc) : null;
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
            return await QueryPostsDirectAsync(query, cancellationToken);
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
            var result = await QueryPostsDirectAsync(query, cancellationToken);
            
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
            return await QueryPostsDirectAsync(query, cancellationToken);
        }
    }

    // Delegate other methods to direct MongoDB queries (no caching for now)
    public async Task<PaginatedResult<PostReadDto>> GetFeedAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        var total = (int)await collection.CountDocumentsAsync(FilterDefinition<PostDocument>.Empty, cancellationToken: cancellationToken);
        var items = await collection.Find(FilterDefinition<PostDocument>.Empty)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);
        return new PaginatedResult<PostReadDto> { Items = items.Select(MapToReadDto).ToList(), TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<PaginatedResult<PostReadDto>> GetUserPostsAsync(Guid authorId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        var filter = Builders<PostDocument>.Filter.Eq(p => p.AuthorId, authorId);
        var total = (int)await collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var items = await collection.Find(filter)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);
        return new PaginatedResult<PostReadDto> { Items = items.Select(MapToReadDto).ToList(), TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<bool> PostExistsAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        return await collection.Find(p => p.Id == postId).AnyAsync(cancellationToken);
    }

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

            // Cache miss - fetch from database
            _logger.LogDebug("📍 Cache MISS for nearby query: {Key}", key);
            var result = await GetNearbyDirectAsync(q, cancellationToken);
            
            // Cache for 60 seconds (short TTL for location data)
            await SetCacheAsync(key, result, TimeSpan.FromSeconds(60), cancellationToken);
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for nearby query, falling back to direct call");
            return await GetNearbyDirectAsync(q, cancellationToken);
        }
    }

    public async Task<PagedResult<PostListDto>> GetBoundsAsync(BoundsQuery query, CancellationToken cancellationToken = default)
    {
        static double Round(double value) => Math.Round(value, 4, MidpointRounding.AwayFromZero);

        var q = query.Clamp();
        var key = $"bounds:{Round(q.MinLat)}:{Round(q.MinLon)}:{Round(q.MaxLat)}:{Round(q.MaxLon)}:{q.Zoom}:{q.SinceMinutes}:{q.Page}:{q.PageSize}";

        try
        {
            var cached = await GetFromCacheAsync<PagedResult<PostListDto>>(key, cancellationToken);
            if (cached is not null)
            {
                _logger.LogDebug("Cache HIT for map bounds query: {Key}", key);
                return cached;
            }

            var result = await GetBoundsDirectAsync(q, cancellationToken);
            await SetCacheAsync(key, result, TimeSpan.FromSeconds(30), cancellationToken);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for map bounds query, falling back to direct call");
            return await GetBoundsDirectAsync(q, cancellationToken);
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
            var result = await GetNearbyPostsDirectAsync(lat, lon, radiusMeters, page, pageSize, cancellationToken);
            
            // Cache for 2 minutes
            await SetCacheAsync(cacheKey, result, TimeSpan.FromMinutes(2), cancellationToken);
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for nearby posts feed, falling back to database");
            return await GetNearbyPostsDirectAsync(lat, lon, radiusMeters, page, pageSize, cancellationToken);
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
            var result = await GetNearbyPostsCountDirectAsync(lat, lon, radiusMeters, cancellationToken);
            
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
            return await GetNearbyPostsCountDirectAsync(lat, lon, radiusMeters, cancellationToken);
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
            var result = await GetPopularPostsDirectAsync(page, pageSize, timeWindow, cancellationToken);
            
            // Cache for 10 minutes
            await SetCacheAsync(cacheKey, result, TimeSpan.FromMinutes(10), cancellationToken);
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for popular posts feed, falling back to database");
            return await GetPopularPostsDirectAsync(page, pageSize, timeWindow, cancellationToken);
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
            var result = await GetLatestPostsDirectAsync(page, pageSize, cancellationToken);
            
            // Cache for 5 minutes
            await SetCacheAsync(cacheKey, result, TimeSpan.FromMinutes(5), cancellationToken);
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cache error for latest posts feed, falling back to database");
            return await GetLatestPostsDirectAsync(page, pageSize, cancellationToken);
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
            var result = await GetTotalPostsCountDirectAsync(cancellationToken);
            
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
            return await GetTotalPostsCountDirectAsync(cancellationToken);
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
    
    /// <summary>
    /// Debug method to check posts with location data (no caching for debug)
    /// </summary>
    public async Task<int> DebugCheckLocationPostsAsync(CancellationToken cancellationToken = default)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        var filter = Builders<PostDocument>.Filter.Ne(p => p.Location, null);
        return (int)await collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
    }

    public async Task<int> UpdatePostLocationsAsync(double latitude, double longitude, string locationName, CancellationToken cancellationToken = default)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        var filter = Builders<PostDocument>.Filter.Eq(p => p.Location, null);
        var location = new LocationEntity 
        { 
            Coordinates = new[] { longitude, latitude },
            Name = locationName,
            CreatedAtUtc = DateTime.UtcNow
        };
        var update = Builders<PostDocument>.Update
            .Set(p => p.Location, location)
            .Set(p => p.LocationName, locationName);
        var result = await collection.UpdateManyAsync(filter, update, cancellationToken: cancellationToken);
        return (int)result.ModifiedCount;
    }

    public async Task<int> UpdateAuthorNamesAsync(CancellationToken cancellationToken = default)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        var filter = Builders<PostDocument>.Filter.Eq(p => p.AuthorName, null);
        var update = Builders<PostDocument>.Update.Set(p => p.AuthorName, "Unknown");
        var result = await collection.UpdateManyAsync(filter, update, cancellationToken: cancellationToken);
        return (int)result.ModifiedCount;
    }

    public async Task<int> SyncPostgresPostsToMongoAsync(CancellationToken cancellationToken = default)
    {
        // This would require access to PostgreSQL context, which is not available in this service
        _logger.LogWarning("SyncPostgresPostsToMongoAsync not implemented in CachedPostQueryService");
        return 0;
    }

    // Direct query methods (no caching)
    private async Task<PagedResult<PostListDto>> QueryPostsDirectAsync(PostQuery query, CancellationToken cancellationToken)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        var filterBuilder = Builders<PostDocument>.Filter;
        var filter = filterBuilder.Empty;

        if (!string.IsNullOrEmpty(query.Search))
        {
            filter = filterBuilder.And(filter, filterBuilder.Regex(p => p.Content, query.Search));
        }

        if (!string.IsNullOrEmpty(query.AuthorId) && Guid.TryParse(query.AuthorId, out var authorId))
        {
            filter = filterBuilder.And(filter, filterBuilder.Eq(p => p.AuthorId, authorId));
        }

        var total = (int)await collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var items = await collection.Find(filter)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip((query.Page - 1) * query.PageSize)
            .Limit(query.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<PostListDto>(
            items.Select(MapToListDto),
            total,
            query.Page,
            query.PageSize
        );
    }

    private async Task<PagedResult<PostListDto>> GetNearbyDirectAsync(NearbyQuery query, CancellationToken cancellationToken)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        var q = query.Clamp();
        
        // Use $geoWithin with $centerSphere for geospatial queries
        var filter = Builders<PostDocument>.Filter.GeoWithinCenterSphere(
            p => p.Location,
            q.Lon,
            q.Lat,
            q.RadiusMeters / 6371000.0  // Convert meters to radians (Earth radius = 6371km)
        );

        var total = (int)await collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var items = await collection.Find(filter)
            .Skip((q.Page - 1) * q.PageSize)
            .Limit(q.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<PostListDto>(
            items.Select(MapToListDto),
            total,
            q.Page,
            q.PageSize
        );
    }

    private async Task<PagedResult<PostListDto>> GetBoundsDirectAsync(BoundsQuery query, CancellationToken cancellationToken)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        var q = query.Clamp();

        var geoFilter = new BsonDocumentFilterDefinition<PostDocument>(
            new BsonDocument("Location", new BsonDocument("$geoWithin",
                new BsonDocument("$box", new BsonArray
                {
                    new BsonArray { q.MinLon, q.MinLat },
                    new BsonArray { q.MaxLon, q.MaxLat }
                }))));

        var now = DateTime.UtcNow;
        var audienceFilter = Builders<PostDocument>.Filter.Or(
            Builders<PostDocument>.Filter.Eq(p => p.AudienceType, null),
            Builders<PostDocument>.Filter.Eq(p => p.AudienceType, "Public"));
        var expiryFilter = Builders<PostDocument>.Filter.Or(
            Builders<PostDocument>.Filter.Eq(p => p.ExpiresAt, null),
            Builders<PostDocument>.Filter.Gt(p => p.ExpiresAt, now));
        var filter = Builders<PostDocument>.Filter.And(geoFilter, audienceFilter, expiryFilter);
        if (q.SinceMinutes > 0)
        {
            var cutoff = DateTime.UtcNow.AddMinutes(-q.SinceMinutes);
            filter = Builders<PostDocument>.Filter.And(
                filter,
                Builders<PostDocument>.Filter.Gte(p => p.CreatedAtUtc, cutoff));
        }

        var total = (int)await collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var items = await collection.Find(filter)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip((q.Page - 1) * q.PageSize)
            .Limit(q.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<PostListDto>(
            items.Select(MapToListDto),
            total,
            q.Page,
            q.PageSize
        );
    }

    private async Task<IEnumerable<PostListDto>> GetNearbyPostsDirectAsync(double lat, double lon, int radiusMeters, int page, int pageSize, CancellationToken cancellationToken)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        
        var filter = Builders<PostDocument>.Filter.GeoWithinCenterSphere(
            p => p.Location,
            lon,
            lat,
            radiusMeters / 6371000.0
        );

        var items = await collection.Find(filter)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);
        
        return items.Select(MapToListDto);
    }

    private async Task<int> GetNearbyPostsCountDirectAsync(double lat, double lon, int radiusMeters, CancellationToken cancellationToken)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        
        var filter = Builders<PostDocument>.Filter.GeoWithinCenterSphere(
            p => p.Location,
            lon,
            lat,
            radiusMeters / 6371000.0
        );

        return (int)await collection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
    }

    private async Task<IEnumerable<PostListDto>> GetPopularPostsDirectAsync(int page, int pageSize, TimeSpan timeWindow, CancellationToken cancellationToken)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        var cutoffDate = DateTime.UtcNow.Subtract(timeWindow);
        var filter = Builders<PostDocument>.Filter.Gte(p => p.CreatedAtUtc, cutoffDate);

        var items = await collection.Find(filter)
            .SortByDescending(p => p.LikeCount)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);
        
        return items.Select(MapToListDto);
    }

    private async Task<IEnumerable<PostListDto>> GetLatestPostsDirectAsync(int page, int pageSize, CancellationToken cancellationToken)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        var items = await collection.Find(FilterDefinition<PostDocument>.Empty)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);
        
        return items.Select(MapToListDto);
    }

    private async Task<int> GetTotalPostsCountDirectAsync(CancellationToken cancellationToken)
    {
        var collection = _mongoDb.GetCollection<PostDocument>("posts");
        return (int)await collection.CountDocumentsAsync(FilterDefinition<PostDocument>.Empty, cancellationToken: cancellationToken);
    }

    private static PostReadDto MapToReadDto(PostDocument doc)
    {
        var (latitude, longitude) = ExtractPublicCoordinates(doc);
        var anonymous = string.Equals(doc.IdentityDisclosure, "AnonymousMap", StringComparison.Ordinal);
        
        return new PostReadDto
        {
            Id = doc.Id,
            Title = doc.Title,
            Content = doc.Content,
            AuthorId = anonymous ? Guid.Empty : doc.AuthorId,
            AuthorName = anonymous ? "Topluluk üyesi" : doc.AuthorName ?? string.Empty,
            CreatedAtUtc = doc.CreatedAtUtc,
            UpdatedAtUtc = doc.UpdatedAtUtc,
            Latitude = latitude,
            Longitude = longitude,
            LocationName = doc.LocationName,
            PlaceId = doc.PlaceId,
            SignalType = doc.SignalType ?? "GeneralObservation",
            SignalValue = doc.SignalValue,
            AudienceType = doc.AudienceType ?? "Public",
            IdentityDisclosure = doc.IdentityDisclosure ?? "LimitedProfile",
            LocationPrecision = doc.LocationPrecision ?? "ApproximateArea",
            SourceType = doc.SourceType ?? "Community",
            ExpiresAt = doc.ExpiresAt,
            LikeCount = doc.LikeCount,
            CommentCount = doc.CommentCount,
            IsLikedByCurrentUser = false,
            Comments = new(),
            Media = doc.Media?.Select(m => new MediaDto
            {
                Id = m.Id,
                Url = m.Url,
                MediaType = m.Type,
                ContentType = m.ContentType,
                SizeBytes = m.SizeBytes,
                Width = m.Width,
                Height = m.Height,
                DurationSeconds = m.DurationSeconds,
                ThumbnailUrl = m.ThumbnailUrl
            }).ToList() ?? new()
        };
    }

    private static PostListDto MapToListDto(PostDocument doc)
    {
        var (latitude, longitude) = ExtractPublicCoordinates(doc);
        var freshnessSec = (int)(DateTime.UtcNow - doc.CreatedAtUtc).TotalSeconds;
        var anonymous = string.Equals(doc.IdentityDisclosure, "AnonymousMap", StringComparison.Ordinal);
        var expiresAt = doc.ExpiresAt ?? doc.CreatedAtUtc.AddHours(3);
        
        return new PostListDto
        {
            Id = doc.Id,
            Title = doc.Title,
            Content = doc.Content,
            AuthorId = anonymous ? Guid.Empty : doc.AuthorId,
            AuthorName = anonymous ? "Topluluk üyesi" : doc.AuthorName ?? string.Empty,
            AuthorGender = null,
            CreatedAt = doc.CreatedAtUtc,
            CreatedAtUtc = doc.CreatedAtUtc,
            UpdatedAtUtc = doc.UpdatedAtUtc,
            Latitude = latitude,
            Longitude = longitude,
            LocationName = doc.LocationName,
            PlaceId = doc.PlaceId,
            SignalType = doc.SignalType ?? "GeneralObservation",
            SignalValue = doc.SignalValue,
            AudienceType = doc.AudienceType ?? "Public",
            IdentityDisclosure = doc.IdentityDisclosure ?? "LimitedProfile",
            LocationPrecision = doc.LocationPrecision ?? "ApproximateArea",
            SourceType = doc.SourceType ?? "Community",
            ExpiresAt = expiresAt,
            LikeCount = doc.LikeCount,
            CommentCount = doc.CommentCount,
            MediaUrls = doc.Media?.Select(m => m.Url).ToList() ?? new(),
            Location = null,
            FreshnessSec = freshnessSec,
            IsLive = expiresAt > DateTime.UtcNow
        };
    }

    private static (double? latitude, double? longitude) ExtractPublicCoordinates(PostDocument doc)
    {
        var (latitude, longitude) = ExtractCoordinates(doc.Location);
        if (!latitude.HasValue || !longitude.HasValue)
        {
            return (null, null);
        }

        if (string.Equals(doc.LocationPrecision, "PlaceCenter", StringComparison.Ordinal) && doc.PlaceId.HasValue)
        {
            return (latitude, longitude);
        }

        return (
            Math.Round(latitude.Value, 3, MidpointRounding.AwayFromZero),
            Math.Round(longitude.Value, 3, MidpointRounding.AwayFromZero));
    }

    private static (double? latitude, double? longitude) ExtractCoordinates(LocationEntity? location)
    {
        if (location?.Coordinates?.Length == 2)
        {
            // GeoJSON format: [longitude, latitude]
            return (location.Coordinates[1], location.Coordinates[0]);
        }
        return (null, null);
    }
}
