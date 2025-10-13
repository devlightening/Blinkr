using BlogService.Api.DTOs;
using BlogService.Api.ReadModels;
using MongoDB.Driver;

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
}
