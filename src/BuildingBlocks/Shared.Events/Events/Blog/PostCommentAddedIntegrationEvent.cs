using Shared.Events.Concretes;

namespace Shared.Events.Events.Blog;

public sealed class PostCommentAddedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid CommentId { get; init; }
    public Guid AuthorId { get; init; }
    public string CommentText { get; init; } = string.Empty;
}

