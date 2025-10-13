namespace BlogService.Api.DTOs;

public record PostReadDto
{
    public Guid Id { get; init; }
    public Guid AuthorId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
    public DateTime CreatedAtUtc { get; init; }
    public int LikeCount { get; init; }
    public List<CommentDto> Comments { get; init; } = new();
    public List<MediaDto> Media { get; init; } = new();
}

public record CommentDto
{
    public Guid CommentId { get; init; }
    public Guid UserId { get; init; }
    public string Text { get; init; } = string.Empty;
    public DateTime CreatedAtUtc { get; init; }
}

public record MediaDto
{
    public string Url { get; init; } = string.Empty;
    public string MediaType { get; init; } = string.Empty;
}

public record PaginatedResult<T>
{
    public List<T> Items { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;
}
