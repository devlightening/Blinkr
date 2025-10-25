using BlogService.Infrastructure.ReadModels;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Services.Queries;
using MongoDB.Driver;
using MongoDB.Bson;
using Microsoft.Extensions.Logging;
using System.Collections;
using System.Linq;

namespace BlogService.Infrastructure.Services;

public class PostQueryService : IPostQueryService
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostQueryService> _logger;

    public PostQueryService(IMongoDatabase database, ILogger<PostQueryService> logger)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task<PostReadDto?> GetPostByIdAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("🔍 Getting post by ID: {PostId}", postId);
        
        var post = await _postsCollection
            .Find(p => p.Id == postId)
            .FirstOrDefaultAsync(cancellationToken);

        if (post == null)
        {
            _logger.LogWarning("⚠️ Post not found: {PostId}", postId);
            return null;
        }

        return MapToPostReadDto(post);
    }

    public async Task<PaginatedResult<PostReadDto>> GetFeedAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("📰 Getting feed: page={Page}, pageSize={PageSize}", page, pageSize);
        
        var skip = (page - 1) * pageSize;
        
        var posts = await _postsCollection
            .Find(FilterDefinition<PostDocument>.Empty)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        var totalCount = await _postsCollection.CountDocumentsAsync(FilterDefinition<PostDocument>.Empty, cancellationToken: cancellationToken);

        var items = posts.Select(MapToPostReadDto).ToList();
        
        return new PaginatedResult<PostReadDto>
        {
            Items = items,
            TotalCount = (int)totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PaginatedResult<PostReadDto>> GetUserPostsAsync(Guid authorId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("👤 Getting user posts: authorId={AuthorId}, page={Page}, pageSize={PageSize}", authorId, page, pageSize);
        
        var skip = (page - 1) * pageSize;
        var filter = Builders<PostDocument>.Filter.Eq(p => p.AuthorId, authorId);
        
        var posts = await _postsCollection
            .Find(filter)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        var totalCount = await _postsCollection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);

        var items = posts.Select(MapToPostReadDto).ToList();
        
        return new PaginatedResult<PostReadDto>
        {
            Items = items,
            TotalCount = (int)totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<bool> PostExistsAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var count = await _postsCollection.CountDocumentsAsync(
            p => p.Id == postId, 
            cancellationToken: cancellationToken);
        
        return count > 0;
    }

    public async Task<PagedResult<PostListDto>> QueryPostsAsync(PostQuery query, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("🔍 Querying posts with filters");
        
        var filterBuilder = Builders<PostDocument>.Filter;
        var filter = filterBuilder.Empty;

        // Author filter
        if (!string.IsNullOrWhiteSpace(query.AuthorId))
        {
            if (Guid.TryParse(query.AuthorId, out var authorGuid))
            {
                filter &= filterBuilder.Eq(p => p.AuthorId, authorGuid);
            }
        }

        // Search filter (title and content)
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchFilter = filterBuilder.Or(
                filterBuilder.Regex(p => p.Title, new BsonRegularExpression(query.Search, "i")),
                filterBuilder.Regex(p => p.Content, new BsonRegularExpression(query.Search, "i"))
            );
            filter &= searchFilter;
        }

        // Sorting - parse Sort string (e.g., "createdAt:desc", "likeCount:desc")
        var sortParts = query.Sort.Split(':');
        var sortField = sortParts.Length > 0 ? sortParts[0].ToLower() : "createdat";
        var sortDirection = sortParts.Length > 1 ? sortParts[1].ToLower() : "desc";
        var isDescending = sortDirection == "desc";

        SortDefinition<PostDocument> sort = sortField switch
        {
            "title" => isDescending 
                ? Builders<PostDocument>.Sort.Descending(p => p.Title)
                : Builders<PostDocument>.Sort.Ascending(p => p.Title),
            "author" => isDescending
                ? Builders<PostDocument>.Sort.Descending(p => p.AuthorId)
                : Builders<PostDocument>.Sort.Ascending(p => p.AuthorId),
            "likecount" => isDescending
                ? Builders<PostDocument>.Sort.Descending(p => p.LikeCount)
                : Builders<PostDocument>.Sort.Ascending(p => p.LikeCount),
            _ => isDescending
                ? Builders<PostDocument>.Sort.Descending(p => p.CreatedAtUtc)
                : Builders<PostDocument>.Sort.Ascending(p => p.CreatedAtUtc)
        };

        // Execute query with pagination
        var skip = query.Skip;
        
        var posts = await _postsCollection
            .Find(filter)
            .Sort(sort)
            .Skip(skip)
            .Limit(query.PageSize)
            .ToListAsync(cancellationToken);

        // Get total count for pagination
        var totalCount = await _postsCollection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);

        // Map to DTOs
        var items = posts.Select(MapToPostListDto).ToList();

        return new PagedResult<PostListDto>(
            items,
            total: (int)totalCount,
            page: query.Page,
            pageSize: query.PageSize
        );
    }

    public async Task<PostReadDto?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        return await GetPostByIdAsync(postId, cancellationToken);
    }

    public async Task<PagedResult<PostListDto>> GetNearbyAsync(NearbyQuery query, CancellationToken cancellationToken = default)
    {
        var q = query.Clamp();
        
        _logger.LogInformation("📍 Nearby query: lat={Lat}, lon={Lon}, radius={Radius}m, page={Page}", 
            q.Lat, q.Lon, q.RadiusMeters, q.Page);

        try
        {
            // Check if any posts have Location field first
            var hasLocationCount = await _postsCollection.CountDocumentsAsync(
                Builders<PostDocument>.Filter.Exists("Location"), 
                cancellationToken: cancellationToken);
                
            _logger.LogInformation("📊 Posts with Location field: {Count}", hasLocationCount);
            
            // DEBUG: Show actual location coordinates
            if (hasLocationCount > 0)
            {
                _logger.LogInformation("🔍 Searching for sample post with Location...");
                
                var samplePost = await _postsCollection.Find(Builders<PostDocument>.Filter.Exists("Location"))
                    .Limit(1)
                    .FirstOrDefaultAsync(cancellationToken);
                    
                _logger.LogInformation("🔍 Sample post found: {Found}", samplePost != null);
                
                if (samplePost?.Location != null)
                {
                    _logger.LogInformation("🗺️ Sample post location type: {Type}", samplePost.Location.Type);
                    _logger.LogInformation("🔍 Location object: {Location}", samplePost.Location.ToString());
                    
                    try 
                    {
                        var coords = samplePost.Location.Coordinates;
                        _logger.LogInformation("🔍 Coordinates object: {Coords}", coords?.ToString() ?? "null");
                        
                        if (coords != null && coords.Any() && coords.Count() >= 2)
                        {
                            var coordArray = coords.ToArray();
                            _logger.LogInformation("📍 Coordinates: [lon={Lon}, lat={Lat}]", 
                                coordArray[0], coordArray[1]);
                        }
                        else
                        {
                            _logger.LogWarning("⚠️ Coordinates null or insufficient count");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ Could not read coordinates: {Error}", ex.Message);
                    }
                }
                else
                {
                    _logger.LogWarning("⚠️ Sample post or Location is null - ADDING TEST LOCATION");
                    
                    // Add test location directly to MongoDB
                    try
                    {
                        var testLocation = new MongoDB.Driver.GeoJsonObjectModel.GeoJsonPoint<MongoDB.Driver.GeoJsonObjectModel.GeoJson2DGeographicCoordinates>(
                            new MongoDB.Driver.GeoJsonObjectModel.GeoJson2DGeographicCoordinates(28.9784, 41.0082));
                            
                        var filter = Builders<PostDocument>.Filter.Empty;
                        var update = Builders<PostDocument>.Update.Set("Location", testLocation);
                        
                        var result = await _postsCollection.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);
                        
                        _logger.LogInformation("🔧 Added test location to {Count} documents", result.ModifiedCount);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ Failed to add test location");
                    }
                }
            }
            
            if (hasLocationCount == 0)
            {
                _logger.LogWarning("⚠️ No posts with Location field found. Returning empty result.");
                return new PagedResult<PostListDto>(
                    new List<PostListDto>(),
                    total: 0,
                    page: q.Page,
                    pageSize: q.PageSize
                );
            }

            // Build geospatial aggregation pipeline
            var pipeline = new BsonDocument[]
            {
                new("$geoNear", new BsonDocument
                {
                    ["near"] = new BsonDocument
                    {
                        ["type"] = "Point",
                        ["coordinates"] = new BsonArray { q.Lon, q.Lat }
                    },
                    ["distanceField"] = "distanceMeters",
                    ["maxDistance"] = q.RadiusMeters,
                    ["spherical"] = true,
                    ["query"] = new BsonDocument() // Empty query - could add filters here
                }),
                new("$skip", (q.Page - 1) * q.PageSize),
                new("$limit", q.PageSize)
            };

            var nearbyPosts = await _postsCollection
                .Aggregate<BsonDocument>(pipeline)
                .ToListAsync(cancellationToken);

            _logger.LogInformation("📍 Nearby query executed. Lat={Lat}, Lon={Lon}, Radius={Radius}m, Found={Count}, Page={Page}", 
                q.Lat, q.Lon, q.RadiusMeters, nearbyPosts.Count, q.Page);

            var items = nearbyPosts.Select(doc =>
            {
                var post = MongoDB.Bson.Serialization.BsonSerializer.Deserialize<PostDocument>(doc);
                
                // Get distance from $geoNear
                double? distance = null;
                if (doc.TryGetValue("distanceMeters", out var distanceValue))
                {
                    distance = distanceValue.ToDouble();
                }
                
                return MapToPostListDtoWithDistance(post, distance);
            }).ToList();

            return new PagedResult<PostListDto>(
                items,
                total: 0, // For performance, we don't calculate total for geo queries
                page: q.Page,
                pageSize: q.PageSize
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error in nearby query: lat={Lat}, lon={Lon}, radius={Radius}m", 
                q.Lat, q.Lon, q.RadiusMeters);
            throw;
        }
    }

    private static PostReadDto MapToPostReadDto(PostDocument post)
    {
        return new PostReadDto
        {
            Id = post.Id,
            AuthorId = post.AuthorId,
            Title = post.Title,
            Content = post.Content,
            CreatedAtUtc = post.CreatedAtUtc,
            LikeCount = post.LikeCount,
            Comments = post.Comments?.Select(c => new CommentDto
            {
                CommentId = c.Id,
                UserId = c.AuthorId,
                Text = c.Text,
                CreatedAtUtc = c.CreatedAtUtc
            }).ToList() ?? new List<CommentDto>(),
            Media = post.Media?.Select(m => new MediaDto
            {
                Url = m.Url,
                MediaType = m.Type
            }).ToList() ?? new List<MediaDto>()
        };
    }

    private static PostListDto MapToPostListDto(PostDocument post)
    {
        return new PostListDto
        {
            Id = post.Id,
            Title = post.Title,
            Content = post.Content,
            AuthorId = post.AuthorId,
            CreatedAtUtc = post.CreatedAtUtc,
            UpdatedAtUtc = post.UpdatedAtUtc,
            LikeCount = post.LikeCount,
            CommentCount = post.CommentCount,
            MediaUrls = post.Media?.Select(m => m.Url).ToList() ?? new List<string>(),
            DistanceMeters = null
        };
    }

    private static PostListDto MapToPostListDtoWithDistance(PostDocument post, double? distance)
    {
        return new PostListDto
        {
            Id = post.Id,
            Title = post.Title,
            Content = post.Content,
            AuthorId = post.AuthorId,
            CreatedAtUtc = post.CreatedAtUtc,
            UpdatedAtUtc = post.UpdatedAtUtc,
            LikeCount = post.LikeCount,
            CommentCount = post.CommentCount,
            MediaUrls = post.Media?.Select(m => m.Url).ToList() ?? new List<string>(),
            DistanceMeters = distance
        };
    }
}
