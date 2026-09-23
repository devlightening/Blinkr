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
    
    // Keep backward compatibility
    public Guid AuthorId => CommentAuthorId;
}

