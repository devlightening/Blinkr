using BlogService.Infrastructure.ReadModels;
using BlogService.Application.DTOs.PostDtos;
using MongoDB.Driver;
using MongoDB.Bson;
using System.Collections;
using System.Linq;

namespace BlogService.Api.Services;

public class PostQueryService : IPostQueryService
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostQueryService> _logger;

    public PostQueryService(IMongoDatabase mongoDatabase, ILogger<PostQueryService> logger)
    {
        _postsCollection = mongoDatabase.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task<PostReadDto?> GetPostByIdAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        try
        {
            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, postId);
            var document = await _postsCollection.Find(filter).FirstOrDefaultAsync(cancellationToken);

            if (document == null)
            {
                _logger.LogWarning("Post not found: {PostId}", postId);
                return null;
            }

            return MapToDto(document);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving post {PostId} from MongoDB", postId);
            throw;
        }
    }

    public async Task<PaginatedResult<PostReadDto>> GetFeedAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        try
        {
            // Validate pagination
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var filter = Builders<PostDocument>.Filter.Empty;
            var sortDefinition = Builders<PostDocument>.Sort.Descending(p => p.CreatedAtUtc);

            var totalCount = await _postsCollection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
            
            var documents = await _postsCollection
                .Find(filter)
                .Sort(sortDefinition)
                .Skip((page - 1) * pageSize)
                .Limit(pageSize)
                .ToListAsync(cancellationToken);

            var dtos = documents.Select(MapToDto).ToList();

            return new PaginatedResult<PostReadDto>
            {
                Items = dtos,
                TotalCount = (int)totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving feed from MongoDB");
            throw;
        }
    }

    public async Task<PaginatedResult<PostReadDto>> GetUserPostsAsync(Guid authorId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        try
        {
            // Validate pagination
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var filter = Builders<PostDocument>.Filter.Eq(p => p.AuthorId, authorId);
            var sortDefinition = Builders<PostDocument>.Sort.Descending(p => p.CreatedAtUtc);

            var totalCount = await _postsCollection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
            
            var documents = await _postsCollection
                .Find(filter)
                .Sort(sortDefinition)
                .Skip((page - 1) * pageSize)
                .Limit(pageSize)
                .ToListAsync(cancellationToken);

            var dtos = documents.Select(MapToDto).ToList();

            return new PaginatedResult<PostReadDto>
            {
                Items = dtos,
                TotalCount = (int)totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving posts for author {AuthorId} from MongoDB", authorId);
            throw;
        }
    }

    public async Task<bool> PostExistsAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        try
        {
            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, postId);
            var count = await _postsCollection.CountDocumentsAsync(filter, new CountOptions { Limit = 1 }, cancellationToken);
            return count > 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking post existence {PostId} in MongoDB", postId);
            throw;
        }
    }

    private static PostReadDto MapToDto(PostDocument document)
    {
        return new PostReadDto
        {
            Id = document.Id,
            AuthorId = document.AuthorId,
            Title = document.Title,
            Content = document.Content,
            CreatedAtUtc = document.CreatedAtUtc,
            LikeCount = document.LikeCount,
            Comments = document.Comments.Select(c => new CommentDto
            {
                CommentId = c.Id,
                UserId = c.AuthorId,
                Text = c.Text,
                CreatedAtUtc = c.CreatedAtUtc
            }).ToList(),
            Media = document.Media.Select(m => new MediaDto
            {
                Url = m.Url,
                MediaType = m.Type
            }).ToList()
        };
    }

    // NEW METHODS FOR ADVANCED QUERYING

    public async Task<PagedResult<PostListDto>> QueryPostsAsync(PostQuery query, CancellationToken cancellationToken = default)
    {
        try
        {
            // Build filter
            var filterBuilder = Builders<PostDocument>.Filter;
            var filter = filterBuilder.Empty;

            // Author filter
            if (!string.IsNullOrEmpty(query.AuthorId) && Guid.TryParse(query.AuthorId, out var authorId))
            {
                filter = filterBuilder.And(filter, filterBuilder.Eq(p => p.AuthorId, authorId));
            }

            // Search filter (title and content)
            if (!string.IsNullOrEmpty(query.Search))
            {
                var searchFilter = filterBuilder.Or(
                    filterBuilder.Regex(p => p.Title, new BsonRegularExpression(query.Search, "i")),
                    filterBuilder.Regex(p => p.Content, new BsonRegularExpression(query.Search, "i"))
                );
                filter = filterBuilder.And(filter, searchFilter);
            }

            // Build sort
            var sortBuilder = Builders<PostDocument>.Sort;
            SortDefinition<PostDocument> sort = query.Sort.ToLowerInvariant() switch
            {
                "createdat:asc" => sortBuilder.Ascending(p => p.CreatedAtUtc),
                "likecount:desc" => sortBuilder.Descending(p => p.LikeCount).Descending(p => p.CreatedAtUtc),
                _ => sortBuilder.Descending(p => p.CreatedAtUtc) // default: createdAt:desc
            };

            // Get total count
            var totalCount = await _postsCollection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);

            // Get items with projection (lightweight for list)
            var projection = Builders<PostDocument>.Projection
                .Include(p => p.Id)
                .Include(p => p.Title)
                .Include(p => p.Content)
                .Include(p => p.AuthorId)
                .Include(p => p.CreatedAtUtc)
                .Include(p => p.UpdatedAtUtc)
                .Include(p => p.LikeCount)
                .Include(p => p.Comments) // Include Comments array instead of CommentCount
                .Include(p => p.Media);

            var documents = await _postsCollection
                .Find(filter)
                .Project<PostDocument>(projection)
                .Sort(sort)
                .Skip(query.Skip)
                .Limit(query.PageSize)
                .ToListAsync(cancellationToken);

            // Map to DTOs
            var items = documents.Select(MapToListDto);

            return new PagedResult<PostListDto>(items, totalCount, query.Page, query.PageSize);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error querying posts with filter: {@Query}", query);
            throw;
        }
    }

    public async Task<PostReadDto?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        // Alias for GetPostByIdAsync (for consistency with new API)
        return await GetPostByIdAsync(postId, cancellationToken);
    }

    private PostListDto MapToListDto(PostDocument document)
    {
        return new PostListDto
        {
            Id = document.Id,
            Title = document.Title,
            Content = document.Content,
            AuthorId = document.AuthorId,
            CreatedAtUtc = document.CreatedAtUtc,
            UpdatedAtUtc = document.UpdatedAtUtc,
            LikeCount = document.LikeCount,
            CommentCount = document.CommentCount,
            MediaUrls = document.Media.Select(m => m.Url).ToList()
        };
    }

    public async Task<PagedResult<PostListDto>> GetNearbyAsync(NearbyQuery query, CancellationToken cancellationToken = default)
    {
        // 1) Validation
        if (query.Lat is < -90 or > 90 || query.Lon is < -180 or > 180)
            throw new ArgumentOutOfRangeException(nameof(query), "Invalid latitude/longitude.");

        var q = query.Clamp();
        var skip = (q.Page - 1) * q.PageSize;

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

            // 2) $geoNear pipeline - MUST be first stage
            var pipeline = new[]
            {
                new BsonDocument("$geoNear", new BsonDocument
                {
                    { "near", new BsonDocument {
                        { "type", "Point" },
                        { "coordinates", new BsonArray { q.Lon, q.Lat } } // CRITICAL: [lon, lat] order
                    }},
                    { "distanceField", "distance" },
                    { "maxDistance", q.RadiusMeters },
                    { "spherical", true },
                    { "query", new BsonDocument() } // Empty filter for now
                }),
                new BsonDocument("$sort", new BsonDocument("distance", 1)),
                new BsonDocument("$skip", skip),
                new BsonDocument("$limit", q.PageSize + 1) // +1 for hasNextPage detection
            };

            // 3) Execute aggregation
            var docs = await _postsCollection.Aggregate<BsonDocument>(pipeline).ToListAsync(cancellationToken);

            // 4) Map to DTOs
            var items = docs.Select(d =>
            {
                var id = d.GetValue("_id", BsonNull.Value)?.ToString() ?? throw new InvalidOperationException("_id missing");
                return new PostListDto
                {
                    Id = Guid.Parse(id),
                    AuthorId = Guid.TryParse(d.GetValue("AuthorId", BsonNull.Value)?.ToString(), out var aid) ? aid : Guid.Empty,
                    Title = d.GetValue("Title", "").AsString,
                    Content = d.GetValue("Content", "").AsString,
                    CreatedAtUtc = d.Contains("CreatedAtUtc") ? d["CreatedAtUtc"].ToUniversalTime() : DateTime.MinValue,
                    LikeCount = d.GetValue("LikeCount", 0).AsInt32,
                    CommentCount = d.GetValue("CommentCount", 0).AsInt32,
                    MediaUrls = d.Contains("Media") ? 
                        d["Media"].AsBsonArray.Select(m => m.AsBsonDocument.GetValue("Url", "").AsString).ToList() : 
                        new List<string>(),
                    DistanceMeters = d.GetValue("distance", 0.0).ToDouble()
                };
            }).ToList();

            // 5) hasNextPage logic (lightweight - no total count)
            var hasNextPage = items.Count() == q.PageSize;

            _logger.LogInformation(
                "📍 Nearby query executed. Lat={Lat}, Lon={Lon}, Radius={Radius}m, Found={Count}, Page={Page}",
                q.Lat, q.Lon, q.RadiusMeters, items.Count(), q.Page);

            return new PagedResult<PostListDto>(
                items,
                total: 0, // Performance: no total count for geo queries
                page: q.Page,
                pageSize: q.PageSize
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "❌ Failed to execute nearby query. Lat={Lat}, Lon={Lon}, Radius={Radius}m. Error: {Error}", 
                q.Lat, q.Lon, q.RadiusMeters, ex.Message);
            
            // Return empty result instead of throwing to avoid 500 errors
            _logger.LogWarning("Returning empty result for nearby query due to error");
            return new PagedResult<PostListDto>(
                new List<PostListDto>(),
                total: 0,
                page: q.Page,
                pageSize: q.PageSize
            );
        }
    }
}
