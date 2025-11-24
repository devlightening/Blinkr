namespace BlogService.Application.DTOs.PostDtos;

/// <summary>
/// Paginated comments response for a specific post
/// </summary>
public class PaginatedCommentsResponse
{
    public Guid PostId { get; set; }
    public List<CommentDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}
