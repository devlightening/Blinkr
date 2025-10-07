namespace Shared.Events;

public interface IIntegrationEvent
{
    Guid Id { get; }
    DateTime OccurredOn { get; }
}

public abstract class IntegrationEvent : IIntegrationEvent
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public DateTime OccurredOn { get; init; } = DateTime.UtcNow;
}

