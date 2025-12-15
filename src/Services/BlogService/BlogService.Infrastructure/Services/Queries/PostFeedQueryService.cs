using BlogService.Infrastructure.ReadModels;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Services.Queries;
using MongoDB.Driver;
using Microsoft.Extensions.Logging;

namespace BlogService.Infrastructure.Services.Queries;

public class PostFeedQueryService
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostFeedQueryService> _logger;

    public PostFeedQueryService(IMongoDatabase database, ILogger<PostFeedQueryService> logger)
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

        return post == null ? null : MapToPostReadDto(post);
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

        var totalCount = await _postsCollection.CountDocumentsAsync(
            FilterDefinition<PostDocument>.Empty, 
            cancellationToken: cancellationToken);

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
        throw new NotImplementedException("Use PostSearchQueryService for search queries");
    }

    public async Task<PostReadDto?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default)
        => await GetPostByIdAsync(postId, cancellationToken);

    public async Task<PagedResult<PostListDto>> GetNearbyAsync(NearbyQuery query, CancellationToken cancellationToken = default)
    {
        throw new NotImplementedException("Use PostNearbyQueryService for nearby queries");
    }

    private PostReadDto MapToPostReadDto(PostDocument post)
    {
        return new PostReadDto
        {
            Id = post.Id,
            AuthorId = post.AuthorId,
            AuthorName = post.AuthorName ?? "Unknown",
            Title = post.Title,
            Content = post.Content,
            CreatedAtUtc = post.CreatedAtUtc,
            UpdatedAtUtc = post.UpdatedAtUtc,
            LikeCount = post.LikeCount,
            CommentCount = post.CommentCount,
            LocationName = post.LocationName,
            Latitude = post.Location?.Coordinates?.Length >= 2 ? post.Location.Coordinates[1] : null,
            Longitude = post.Location?.Coordinates?.Length >= 2 ? post.Location.Coordinates[0] : null,
            Comments = post.Comments?.Select(c => new CommentDto
            {
                CommentId = c.Id,
                UserId = c.AuthorId,
                Text = c.Text,
                CreatedAtUtc = c.CreatedAtUtc
            }).ToList() ?? new(),
            Media = post.Media?.Select(m => new MediaDto
            {
                Url = m.Url,
                MediaType = m.Type
            }).ToList() ?? new()
        };
    }
}
