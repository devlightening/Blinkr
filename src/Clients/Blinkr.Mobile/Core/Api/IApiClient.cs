using Refit;

namespace Blinkr.Mobile.Core.Api;

public interface IApiClient
{
    // Nearby Posts
    [Get("/api/posts-read/nearby")]
    Task<PagedResult<PostListDto>> GetNearbyAsync(
        [Query] double lat, 
        [Query] double lon, 
        [Query] int radius = 5000, 
        [Query] int page = 1, 
        [Query] int pageSize = 15);

    // Feed Posts
    [Get("/api/posts-read")]
    Task<PagedResult<PostListDto>> GetFeedAsync(
        [Query] int page = 1, 
        [Query] int pageSize = 15,
        [Query] string? sort = null);

    // Add Location
    [Post("/api/posts/{postId}/location")]
    Task<ApiResult> AddLocationAsync(Guid postId, [Body] AddLocationRequest req);

    // Create Post
    [Post("/api/posts")]
    Task<ApiResult<Guid>> CreatePostAsync([Body] CreatePostRequest req);
}

// DTOs
public record PagedResult<T>(
    IReadOnlyList<T> Items, 
    int TotalCount, 
    int Page, 
    int PageSize) 
{
    public bool HasNext => Page * PageSize < TotalCount;
}

public record PostListDto(
    Guid Id, 
    string Title, 
    string Content,
    string AuthorName,
    DateTime CreatedAt,
    int LikeCount,
    double? DistanceMeters = null,
    string? LocationName = null);

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
    string? LocationName = null);

public record ApiResult(bool Success, string? Message = null);
public record ApiResult<T>(bool Success, T? Data = default, string? Message = null);
