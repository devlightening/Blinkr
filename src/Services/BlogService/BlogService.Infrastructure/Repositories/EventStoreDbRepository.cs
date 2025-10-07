using BlogService.Domain.Common.Interfaces;
using EventStore.Client;
using Shared.Events.Bus;
using System.Text.Json;

namespace BlogService.Infrastructure.Repositories;

public class EventStoreDbRepository : IEventStoreRepository
{
    private readonly EventStoreClient _client;
    private readonly IEventBus _bus;

    public EventStoreDbRepository(EventStoreClient client, IEventBus bus)
    {
        _client = client;
        _bus = bus;
    }

    public async Task<T> LoadAsync<T>(Guid aggregateId, CancellationToken cancellationToken) where T : IAggregateRoot, new()
    {
        var stream = GetStreamName<T>(aggregateId);
        var result = _client.ReadStreamAsync(Direction.Forwards, stream, StreamPosition.Start, cancellationToken: cancellationToken);

        var aggregate = new T();
        var events = new List<IDomainEvent>();

        if (await result.ReadState == ReadState.StreamNotFound)
            return aggregate;

        await foreach (var resolved in result.WithCancellation(cancellationToken))
        {
            var typeHeader = resolved.Event.EventType; // stored as AssemblyQualifiedName
            var data = resolved.Event.Data.ToArray();
            var type = Type.GetType(typeHeader) ?? throw new InvalidOperationException($"Unknown event type: {typeHeader}");
            var domainEvent = (IDomainEvent?)JsonSerializer.Deserialize(data, type);
            if (domainEvent is null) throw new InvalidOperationException($"Failed to deserialize {typeHeader}");
            events.Add(domainEvent);
        }

        aggregate.LoadFromHistory(events);
        return aggregate;
    }

    public async Task SaveAsync(IAggregateRoot aggregate, CancellationToken cancellationToken)
    {
        var stream = GetStreamName(aggregate.GetType(), aggregate.Id);

        var events = aggregate.GetUncommittedEvents().Select(e =>
        {
            var type = e.GetType().AssemblyQualifiedName!;
            var data = JsonSerializer.SerializeToUtf8Bytes(e);
            var meta = JsonSerializer.SerializeToUtf8Bytes(new { occurredOn = e.OccurredOn });
            return new EventData(Uuid.NewUuid(), type, data, meta);
        });

        await _client.AppendToStreamAsync(stream, StreamState.Any, events, cancellationToken: cancellationToken);

        // Optionally publish integration events here (mapping left to handlers or mapper layer)
        aggregate.MarkEventsAsCommitted();
    }

    private static string GetStreamName<T>(Guid id) => $"{typeof(T).Name.ToLowerInvariant()}-{id}";
    private static string GetStreamName(Type t, Guid id) => $"{t.Name.ToLowerInvariant()}-{id}";
}

