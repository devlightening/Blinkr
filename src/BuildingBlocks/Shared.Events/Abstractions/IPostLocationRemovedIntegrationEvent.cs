namespace Shared.Events.Abstractions;

/// <summary>
/// Integration event for post location removed
/// </summary>
public interface IPostLocationRemovedIntegrationEvent
{
    Guid PostId { get; }
    DateTime OccurredOn { get; }
}
