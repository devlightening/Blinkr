using Shared.Events.Abstractions;

namespace Shared.Events.Concretes;

public abstract class IntegrationEvent : IIntegrationEvent
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public DateTime OccurredOn { get; init; } = DateTime.UtcNow;
}

