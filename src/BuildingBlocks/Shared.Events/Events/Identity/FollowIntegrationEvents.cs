using Shared.Events.Concretes;

namespace Shared.Events.Events.Identity;

/// <summary>
/// Someone followed someone (sinyal-mvp-plan Faz 9 P9.5). <see cref="Requested"/> is true for a private account, where
/// it is a follow request waiting for approval. Published by IdentityService after the follow is saved.
/// </summary>
public sealed class UserFollowedIntegrationEvent : IntegrationEvent
{
    public Guid FollowerId { get; init; }
    public string FollowerName { get; init; } = string.Empty;
    public Guid FolloweeId { get; init; }
    public bool Requested { get; init; }
    public DateTime OccurredAtUtc { get; init; }
}

/// <summary>A private account accepted a follow request: the follower is told.</summary>
public sealed class FollowRequestAcceptedIntegrationEvent : IntegrationEvent
{
    /// <summary>Who accepted (the private account).</summary>
    public Guid AccepterId { get; init; }
    public string AccepterName { get; init; } = string.Empty;
    /// <summary>Who asked and is now following.</summary>
    public Guid FollowerId { get; init; }
    public DateTime OccurredAtUtc { get; init; }
}
