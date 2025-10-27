namespace BlogService.Application.DTOs.PostDtos;

/// <summary>
/// Post item for list responses (lightweight)
/// </summary>
public record PostListDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Content { get; init; } = string.Empty;
    public Guid AuthorId { get; init; }
    public string AuthorName { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime? UpdatedAtUtc { get; init; }
    public int LikeCount { get; init; }
    public int CommentCount { get; init; }
    public List<string> MediaUrls { get; init; } = new();
    public string? LocationName { get; init; }
    public object? Location { get; init; }
    
    /// <summary>
    /// Distance in meters (populated by $geoNear queries)
    /// </summary>
    public double? DistanceMeters { get; init; }

    /// <summary>
    /// Content preview (first 200 chars)
    /// </summary>
    public string ContentPreview => Content.Length > 200 
        ? Content[..200] + "..." 
        : Content;
}
