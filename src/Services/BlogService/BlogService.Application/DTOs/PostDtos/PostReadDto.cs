namespace BlogService.Application.DTOs.PostDtos;

/// <summary>
/// Full post detail for single post view
/// </summary>
public record PostReadDto
{
    public Guid Id { get; init; }
    public Guid AuthorId { get; init; }
    public string AuthorName { get; init; } = string.Empty;
    public string? AuthorAvatarUrl { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
    public DateTime CreatedAtUtc { get; init; }
    public DateTime? UpdatedAtUtc { get; init; }
    public int LikeCount { get; init; }
    public int CommentCount { get; init; }
    public bool IsLikedByCurrentUser { get; init; }
    public List<CommentDto> Comments { get; init; } = new();
    public List<MediaDto> Media { get; init; } = new();
    
    // Location
    public string? LocationName { get; init; }
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
}
