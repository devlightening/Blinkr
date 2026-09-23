using Shared.Events.Concretes;

namespace Shared.Events.Events.Identity;

/// <summary>
/// A signal's moderation state changed (sinyal-mvp-plan Faz 10 P10.3/P10.4): hidden after enough weighted reports or
/// by a moderator, restored, or removed for good. Published by IdentityService (which owns reports); the projection
/// worker marks the post read model and PlaceService stops counting the signal in live place state.
/// Consumers must be idempotent: the same state can arrive twice.
/// </summary>
public sealed class PostModerationChangedIntegrationEvent : IntegrationEvent
{
    public const string Hidden = "hidden";
    public const string Visible = "visible";
    public const string Removed = "removed";

    public Guid PostId { get; init; }
    /// <summary><see cref="Hidden"/>, <see cref="Visible"/> or <see cref="Removed"/>.</summary>
    public string State { get; init; } = Hidden;
    /// <summary>auto_hide | hide | restore | remove</summary>
    public string Action { get; init; } = string.Empty;
    public DateTime OccurredAtUtc { get; init; }
}

/// <summary>A moderator sanctioned a person (warning, 24 h posting limit, 7 day suspension, ban): they are told in the app.</summary>
public sealed class UserSanctionedIntegrationEvent : IntegrationEvent
{
    public Guid UserId { get; init; }
    /// <summary>warn | restrict_24h | suspend_7d | ban</summary>
    public string Action { get; init; } = string.Empty;
    public DateTime? UntilUtc { get; init; }
    public DateTime OccurredAtUtc { get; init; }
}
