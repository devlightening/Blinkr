namespace Shared.Events.Events.Blog;

public sealed class PostCreatedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid AuthorId { get; init; }
    public string Title { get; init; } = string.Empty;
}

public sealed class PostCommentAddedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid CommentId { get; init; }
    public Guid AuthorId { get; init; }
    public string CommentText { get; init; } = string.Empty;
}

public sealed class PostLikedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid UserId { get; init; }
}

