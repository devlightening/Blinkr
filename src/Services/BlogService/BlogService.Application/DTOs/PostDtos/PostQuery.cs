namespace BlogService.Application.DTOs.PostDtos;

/// <summary>
/// Query parameters for post list endpoint
/// </summary>
public record PostQuery
{
    /// <summary>
    /// Page number (1-based)
    /// </summary>
    public int Page { get; init; } = 1;

    /// <summary>
    /// Items per page (max 100)
    /// </summary>
    public int PageSize { get; init; } = 20;

    /// <summary>
    /// Filter by author ID
    /// </summary>
    public string? AuthorId { get; init; }

    /// <summary>
    /// Include the author's anonymous posts. Set only when the caller IS that author; otherwise
    /// anonymous posts are never attributable to an author id.
    /// </summary>
    public bool IncludeAnonymousAuthored { get; init; }

    /// <summary>
    /// Search in title and content
    /// </summary>
    public string? Search { get; init; }

    /// <summary>
    /// Sort order: createdAt:desc, createdAt:asc, likeCount:desc
    /// </summary>
    public string Sort { get; init; } = "createdAt:desc";

    /// <summary>
    /// Skip count for MongoDB
    /// </summary>
    public int Skip => (Page - 1) * PageSize;
}
