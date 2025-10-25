using BlogService.Application.DTOs.PostDtos;

namespace BlogService.Application.Services.Queries;

/// <summary>
/// Query service for reading posts from MongoDB read model
/// </summary>
public interface IPostQueryService
{
    /// <summary>
    /// Get a single post by ID
    /// </summary>
    Task<PostReadDto?> GetPostByIdAsync(Guid postId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get paginated feed of all posts (newest first)
    /// </summary>
    Task<PaginatedResult<PostReadDto>> GetFeedAsync(int page, int pageSize, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get paginated posts by a specific author
    /// </summary>
    Task<PaginatedResult<PostReadDto>> GetUserPostsAsync(Guid authorId, int page, int pageSize, CancellationToken cancellationToken = default);

    /// <summary>
    /// Check if a post exists
    /// </summary>
    Task<bool> PostExistsAsync(Guid postId, CancellationToken cancellationToken = default);

    // NEW METHODS FOR ADVANCED QUERYING

    /// <summary>
    /// Query posts with advanced filtering, pagination, and search
    /// </summary>
    Task<PagedResult<PostListDto>> QueryPostsAsync(PostQuery query, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get post detail by ID (for detail endpoint)
    /// </summary>
    Task<PostReadDto?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get nearby posts within specified radius (geospatial query)
    /// </summary>
    Task<PagedResult<PostListDto>> GetNearbyAsync(NearbyQuery query, CancellationToken cancellationToken = default);
}
