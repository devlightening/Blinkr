using Refit;

namespace Blinkr.Mobile.Core.Api;

/// <summary>
/// Refit API client interface - only contains Refit-decorated methods
/// </summary>
public interface IApiClient
{
    // Feed API - Get feed with sorting
    [Get("/api/v1/Feed")]
    Task<FeedResponse> GetFeedAsync(
        [Query] string sort = "nearby",
        [Query] int page = 1,
        [Query] int pageSize = 15,
        [Query] double? lat = null,
        [Query] double? lon = null);

    // Add Location
    [Post("/api/posts/{postId}/location")]
    Task<ApiResult> AddLocationAsync(Guid postId, [Body] AddLocationRequest req);

    // Create Post
    [Post("/api/posts")]
    Task<ApiResult<Guid>> CreatePostAsync([Body] CreatePostRequest req);
}

/// <summary>
/// Extension methods for IApiClient to provide convenience methods
/// </summary>
public static class ApiClientExtensions
{
    public static async Task<PagedResult<PostListDto>> GetNearbyAsync(
        this IApiClient client,
        double lat,
        double lon,
        int radius = 5000,
        int page = 1,
        int pageSize = 15)
    {
        var response = await client.GetFeedAsync("nearby", page, pageSize, lat, lon);
        return new PagedResult<PostListDto>(
            response.Items,
            response.Pagination.TotalCount,
            response.Pagination.CurrentPage,
            response.Pagination.PageSize
        );
    }

    public static async Task<PagedResult<PostListDto>> GetFeedAsync(
        this IApiClient client,
        int page,
        int pageSize,
        string? sort)
    {
        var sortParam = sort switch
        {
            "likeCount:desc" => "popular",
            "createdAt:desc" => "new",
            _ => "nearby"
        };

        var response = await client.GetFeedAsync(sortParam, page, pageSize);
        return new PagedResult<PostListDto>(
            response.Items,
            response.Pagination.TotalCount,
            response.Pagination.CurrentPage,
            response.Pagination.PageSize
        );
    }
}

// DTOs
public record PagedResult<T>(
    IEnumerable<T> Items, 
    int Total, 
    int Page, 
    int PageSize) 
{
    public bool HasNext => Page * PageSize < Total;
    
    // Backward compatibility properties
    public int TotalCount => Total;
    public IReadOnlyList<T> ItemsList => Items.ToList();
}

public record FeedResponse
{
    public List<PostListDto> Items { get; init; } = new();
    public PaginationInfo Pagination { get; init; } = new();
    public string Sort { get; init; } = string.Empty;
    public DateTime Timestamp { get; init; }
}

public record PaginationInfo
{
    public int CurrentPage { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public bool HasMore { get; init; }
    public int TotalPages { get; init; }
}

public record PostListDto(
    Guid Id, 
    string Title, 
    string Content,
    string AuthorName,
    DateTime CreatedAt,
    int LikeCount,
    int CommentCount,
    List<string>? MediaUrls = null,
    string? LocationName = null,
    object? Location = null,
    double? Latitude = null,
    double? Longitude = null,
    double? DistanceMeters = null);

public record AddLocationRequest(
    double Latitude, 
    double Longitude, 
    string? LocationName = null, 
    string Precision = "exact");

public record CreatePostRequest(
    string Title, 
    string Content,
    double? Latitude = null,
    double? Longitude = null,
    double? AccuracyMeters = null,
    string? LocationName = null);

public record ApiResult(bool Success, string? Message = null);
public record ApiResult<T>(bool Success, T? Data = default, string? Message = null);
