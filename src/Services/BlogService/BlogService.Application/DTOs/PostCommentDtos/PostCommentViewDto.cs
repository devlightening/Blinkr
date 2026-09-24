namespace BlogService.Application.DTOs.PostCommentDtos;

/// <summary>
/// One comment as a viewer sees it. On an AnonymousMap post the post author's own comments carry no
/// user id or name (IsPostAuthor only), so commenting never de-anonymises a signal (kök CLAUDE.md §10.3).
/// </summary>
public record PostCommentViewDto
{
    public Guid CommentId { get; init; }
    public Guid? AuthorId { get; init; }
    public string AuthorName { get; init; } = string.Empty;
    public bool IsPostAuthor { get; init; }
    public bool IsMine { get; init; }
    public bool CanDelete { get; init; }
    public Guid? ParentCommentId { get; init; }
    public string Text { get; init; } = string.Empty;
    public DateTime CreatedAtUtc { get; init; }
    /// <summary>V2-4 (D-027): how many liked it and whether I did; the likers themselves are never listed.</summary>
    public int LikeCount { get; init; }
    public bool LikedByMe { get; init; }
    /// <summary>V2-4: people @mentioned in the comment (the text's @name links to them).</summary>
    public List<BlogService.Application.Services.MentionDto> Mentions { get; init; } = new();
    public List<PostCommentViewDto> Replies { get; init; } = new();
}

public record PostCommentThreadPageDto
{
    public Guid PostId { get; init; }
    public List<PostCommentViewDto> Items { get; init; } = new();
    public int Page { get; init; }
    public int PageSize { get; init; }
    /// <summary>Top-level comments only.</summary>
    public int TotalCount { get; init; }
    /// <summary>All comments including replies.</summary>
    public int CommentCount { get; init; }
    public bool HasMore { get; init; }
}
