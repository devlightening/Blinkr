using Shared.Events.Concretes;

namespace Shared.Events.Events.Place;

/// <summary>
/// A place's live state changed because of a new server-verified signal (D-038, "Haber ver"). Published by PlaceService
/// (which owns place state) only when the state people see actually changes, never for every signal; NotificationsService
/// tells the people watching that place. Internal to the bus: <see cref="CausedByAuthorId"/> only lets the watcher who
/// caused the change be skipped and never reaches a client.
/// The <see cref="IntegrationEvent.Id"/> is derived from <see cref="CausedByPostId"/>, so a redelivered or republished
/// event keeps its identity; consumers must still be idempotent.
/// </summary>
public sealed class PlaceLiveStateChangedIntegrationEvent : IntegrationEvent
{
    public Guid PlaceId { get; init; }
    public string PlaceName { get; init; } = string.Empty;
    /// <summary>The new live state: Crowd, Queue, TemporaryStatus, ...</summary>
    public string? SignalType { get; init; }
    /// <summary>Calm / Moderate / Busy, None / 5To15 / Over15, Open / Closed ...</summary>
    public string? SignalValue { get; init; }
    public Guid CausedByPostId { get; init; }
    public Guid? CausedByAuthorId { get; init; }
    public DateTime ObservedAtUtc { get; init; }
}
