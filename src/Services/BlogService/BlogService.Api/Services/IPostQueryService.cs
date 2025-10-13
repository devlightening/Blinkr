using BlogService.Api.DTOs;

namespace BlogService.Api.Services;

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
}
