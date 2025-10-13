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
