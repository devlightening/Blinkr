using Shared.Events.Concretes;

namespace Shared.Events.Events.Blog;

public sealed class PostCommentAddedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid PostOwnerId { get; init; }
    public Guid CommentId { get; init; }
    public Guid CommentAuthorId { get; init; }
    public string CommentAuthorName { get; init; } = string.Empty;
    public string CommentText { get; init; } = string.Empty;
    /// <summary>Top-level comment this one replies to; null for a top-level comment.</summary>
    public Guid? ParentCommentId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
    /// <summary>V2-4: people @mentioned in the comment, resolved by BlogService (blocked people never appear).</summary>
    public List<MentionedUser>? Mentions { get; init; }
    /// <summary>V2-4: the anonymous post's own author commenting; nobody may be told who wrote it.</summary>
    public bool AuthorHidden { get; init; }
    
    // Keep backward compatibility
    public Guid AuthorId => CommentAuthorId;
}

