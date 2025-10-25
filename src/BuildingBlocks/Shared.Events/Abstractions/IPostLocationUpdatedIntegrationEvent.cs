namespace Shared.Events.Abstractions;

/// <summary>
/// Integration event for post location updated
/// </summary>
public interface IPostLocationUpdatedIntegrationEvent
{
    Guid PostId { get; }
    double Lat { get; }
    double Lon { get; }
    string? Name { get; }
    DateTime OccurredOn { get; }
}
