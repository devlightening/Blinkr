using BlogService.Application.Common.Interfaces;
using BlogService.Domain.Common.Interfaces;
using EventStore.Client;
using System.Text.Json;

namespace BlogService.Infrastructure.Repositories;

public class EventStoreDbRepository : IEventStoreRepository
{
    private readonly EventStoreClient _client;

    public EventStoreDbRepository(EventStoreClient client)
    {
        _client = client;
    }

    public async Task<T> LoadAsync<T>(Guid aggregateId, CancellationToken cancellationToken) where T : IAggregateRoot, new()
    {
        var streamName = GetStreamName(typeof(T), aggregateId);
        var result = _client.ReadStreamAsync(Direction.Forwards, streamName, StreamPosition.Start, cancellationToken: cancellationToken);

        var aggregate = new T();
        var events = new List<IDomainEvent>();

        if (await result.ReadState == ReadState.StreamNotFound)
            return aggregate;

        await foreach (var resolved in result.WithCancellation(cancellationToken))
        {
            var typeHeader = resolved.Event.EventType;
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
        var streamName = GetStreamName(aggregate.GetType(), aggregate.Id);
        var uncommitted = aggregate.GetUncommittedEvents().ToList();
        if (uncommitted.Count == 0) return;

        var eventDataBatch = uncommitted.Select(e =>
        {
            var type = e.GetType().AssemblyQualifiedName!;
            var data = JsonSerializer.SerializeToUtf8Bytes(e, e.GetType());
            return new EventData(Uuid.NewUuid(), type, data);
        });

        var expectedRevision = StreamRevision.FromInt64(aggregate.Version - uncommitted.Count);

        await _client.AppendToStreamAsync(streamName, expectedRevision, eventDataBatch, cancellationToken: cancellationToken);

        aggregate.MarkEventsAsCommitted();
    }

    private static string GetStreamName(Type t, Guid id) => $"{t.Name}-{id}";
}

