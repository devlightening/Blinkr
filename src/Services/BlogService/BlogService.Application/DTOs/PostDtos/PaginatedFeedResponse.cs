namespace BlogService.Application.DTOs.PostDtos;

/// <summary>
/// Paginated feed response with sorting support
/// </summary>
public class PaginatedFeedResponse
{
    public List<PostReadDto> Items { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}
