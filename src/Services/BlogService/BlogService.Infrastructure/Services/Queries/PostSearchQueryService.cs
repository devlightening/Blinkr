using BlogService.Infrastructure.ReadModels;
using BlogService.Application.DTOs.PostDtos;
using MongoDB.Driver;
using MongoDB.Bson;
using Microsoft.Extensions.Logging;

namespace BlogService.Infrastructure.Services.Queries;

public class PostSearchQueryService
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostSearchQueryService> _logger;

    public PostSearchQueryService(IMongoDatabase database, ILogger<PostSearchQueryService> logger)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task<PagedResult<PostListDto>> QueryPostsAsync(PostQuery query, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("🔍 Querying posts with filters");

        var filter = BuildFilter(query);
        var sort = BuildSort(query);

        var skip = query.Skip;
        var posts = await _postsCollection
            .Find(filter)
            .Sort(sort)
            .Skip(skip)
            .Limit(query.PageSize)
            .ToListAsync(cancellationToken);

        var totalCount = await _postsCollection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        var items = posts.Select(MapToPostListDto).ToList();

        return new PagedResult<PostListDto>(
            items,
            total: (int)totalCount,
            page: query.Page,
            pageSize: query.PageSize
        );
    }

    private FilterDefinition<PostDocument> BuildFilter(PostQuery query)
    {
        var filterBuilder = Builders<PostDocument>.Filter;
        var filter = filterBuilder.Empty;

        if (!string.IsNullOrWhiteSpace(query.AuthorId) && Guid.TryParse(query.AuthorId, out var authorGuid))
        {
            filter &= filterBuilder.Eq(p => p.AuthorId, authorGuid);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchFilter = filterBuilder.Or(
                filterBuilder.Regex(p => p.Title, new BsonRegularExpression(query.Search, "i")),
                filterBuilder.Regex(p => p.Content, new BsonRegularExpression(query.Search, "i"))
            );
            filter &= searchFilter;
        }

        return filter;
    }

    private SortDefinition<PostDocument> BuildSort(PostQuery query)
    {
        var sortParts = query.Sort.Split(':');
        var sortField = sortParts.Length > 0 ? sortParts[0].ToLower() : "createdat";
        var sortDirection = sortParts.Length > 1 ? sortParts[1].ToLower() : "desc";
        var isDescending = sortDirection == "desc";

        return sortField switch
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
    }

    private PostListDto MapToPostListDto(PostDocument post)
    {
        return new PostListDto
        {
            Id = post.Id,
            AuthorId = post.AuthorId,
            AuthorName = post.AuthorName ?? "Unknown",
            AuthorGender = post.AuthorGender,
            Title = post.Title,
            Content = post.Content,
            CreatedAtUtc = post.CreatedAtUtc,
            LikeCount = post.LikeCount,
            CommentCount = post.CommentCount,
            MediaUrls = post.Media?.Select(m => m.Url).ToList() ?? new()
        };
    }
}
