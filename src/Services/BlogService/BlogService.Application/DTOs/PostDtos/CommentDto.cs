namespace BlogService.Application.DTOs.PostDtos;

public record CommentDto
{
    public Guid CommentId { get; init; }
    public Guid UserId { get; init; }
    public string Text { get; init; } = string.Empty;
    public DateTime CreatedAtUtc { get; init; }
}
