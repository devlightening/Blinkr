using Shared.Events.Concretes;

namespace Shared.Events.Events.Blog;

public sealed class PostLikedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid PostOwnerId { get; init; }
    public Guid LikerUserId { get; init; }
    public string LikerUserName { get; init; } = string.Empty;
    public DateTime OccurredAtUtc { get; init; }
    
    // Keep backward compatibility
    public Guid UserId => LikerUserId;
}

public sealed class PostUnlikedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid PostOwnerId { get; init; }
    public Guid LikerUserId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
}

