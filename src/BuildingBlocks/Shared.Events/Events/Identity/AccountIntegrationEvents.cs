using Shared.Events.Concretes;

namespace Shared.Events.Events.Identity;

/// <summary>
/// An account reached the end of its 30-day deletion grace (plan-devam F3, P10.7) and is being erased. Published by
/// IdentityService before it erases its own data; every service removes what belongs to the person: BlogService their
/// signals (PostDeleted, so the map, feed and place state drop them), comments, likes, views and media; Notifications
/// their chat content, snaps, stories and notifications. Consumers must be idempotent - a failed sweep republishes.
/// </summary>
public sealed class UserDeletedIntegrationEvent : IntegrationEvent
{
    public Guid UserId { get; init; }
    public DateTime DeletedAtUtc { get; init; }
}
