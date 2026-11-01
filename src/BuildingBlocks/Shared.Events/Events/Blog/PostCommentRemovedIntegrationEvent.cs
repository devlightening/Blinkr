using Shared.Events.Concretes;

namespace Shared.Events.Events.Blog;

/// <summary>A comment (and any replies to it) was removed from a post.</summary>
public sealed class PostCommentRemovedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid CommentId { get; init; }
    public Guid RemovedByUserId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
}
