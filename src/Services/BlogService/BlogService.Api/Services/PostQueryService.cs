using BlogService.Api.DTOs;
using BlogService.Api.ReadModels;
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
                    { "minDistance", 1 }, // Filter out same-point jitter (1 meter minimum)
                    { "spherical", true }
                }),
                new BsonDocument("$sort", new BsonDocument("distance", 1)),
                new BsonDocument("$skip", skip),
                new BsonDocument("$limit", q.PageSize)
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
                "❌ Failed to execute nearby query. Lat={Lat}, Lon={Lon}, Radius={Radius}m", 
                q.Lat, q.Lon, q.RadiusMeters);
            throw;
        }
    }
}
