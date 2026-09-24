using Shared.Events.Concretes;

namespace Shared.Events.Events.Blog;

/// <summary>V2-4 (D-027): a comment was liked. Projections keep the likers per comment.</summary>
public sealed class PostCommentLikedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid CommentId { get; init; }
    public Guid UserId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
}

/// <summary>V2-4 (D-027): a comment like was taken back.</summary>
public sealed class PostCommentUnlikedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid CommentId { get; init; }
    public Guid UserId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
}

/// <summary>V2-4 (D-027): someone @mentioned in a post or comment, as resolved by BlogService.</summary>
public sealed class MentionedUser
{
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
}
