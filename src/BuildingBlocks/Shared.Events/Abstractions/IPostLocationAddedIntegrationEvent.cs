namespace Shared.Events.Abstractions;

/// <summary>
/// Integration event for post location added
/// </summary>
public interface IPostLocationAddedIntegrationEvent
{
    Guid PostId { get; }
    double Lat { get; }
    double Lon { get; }
    string? Name { get; }
    DateTime OccurredOn { get; }
}
