using Shared.Events.Concretes;

namespace Shared.Events.Events.Blog;

public sealed class PostLikedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid UserId { get; init; }
}

