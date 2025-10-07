namespace Shared.Events.Bus;

public interface IEventBus
{
    Task PublishAsync<T>(T @event, string? routingKey = null, CancellationToken ct = default) where T : IIntegrationEvent;
}

public sealed class NoopEventBus : IEventBus
{
    public Task PublishAsync<T>(T @event, string? routingKey = null, CancellationToken ct = default) where T : IIntegrationEvent
        => Task.CompletedTask;
}

