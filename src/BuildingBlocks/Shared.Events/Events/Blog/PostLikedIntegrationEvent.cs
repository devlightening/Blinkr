using Shared.Events.Concretes;

namespace Shared.Events.Events.Blog;

public sealed class PostLikedIntegrationEvent : IntegrationEvent
{
    public Guid PostId { get; init; }
    public Guid PostOwnerId { get; init; }
    public Guid LikerUserId { get; init; }
    public string LikerUserName { get; init; } = string.Empty;
    public DateTime OccurredAtUtc { get; init; }
    /// <summary>V2-4: the emoji (ReactionCatalog); null = the heart, as every older like.</summary>
    public string? Reaction { get; init; }
    /// <summary>V2-4: an existing reaction changed its emoji (no new notification; projections update in place).</summary>
    public bool Replaces { get; init; }
    
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

