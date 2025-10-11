using BlogService.Application.Common.Interfaces;
using BlogService.Domain.Common.Interfaces;
using EventStore.Client;
using System.Text.Json;

namespace BlogService.Infrastructure.Repositories;

public class EventStoreDbRepository : IEventStoreRepository
{
    private readonly EventStoreClient _client;
    public EventStoreDbRepository(EventStoreClient client) => _client = client;

    public async Task<T> LoadAsync<T>(Guid aggregateId, CancellationToken cancellationToken) where T : IAggregateRoot, new()
    {
        var streamName = GetStreamName(typeof(T), aggregateId);
        var result = _client.ReadStreamAsync(Direction.Forwards, streamName, StreamPosition.Start, cancellationToken: cancellationToken);
        var aggregate = new T();
        if (await result.ReadState == ReadState.StreamNotFound) return aggregate;

        var events = new List<IDomainEvent>();
        await foreach (var resolved in result.WithCancellation(cancellationToken))
        {
            var type = Type.GetType(resolved.Event.EventType);
            if (type == null) continue;
            var domainEvent = (IDomainEvent?)JsonSerializer.Deserialize(resolved.Event.Data.ToArray(), type);
            if (domainEvent != null) events.Add(domainEvent);
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

        // DÜZELTME (Analiz #3): Yeni stream için doðru versiyon kontrolü
        var originalVersion = aggregate.Version - uncommitted.Count;

        try
        {
            if (originalVersion < 0)
            {
                await _client.AppendToStreamAsync(streamName, StreamState.NoStream, eventDataBatch, cancellationToken: cancellationToken);
            }
            else
            {
                await _client.AppendToStreamAsync(streamName, StreamRevision.FromInt64(originalVersion), eventDataBatch, cancellationToken: cancellationToken);
            }
        }
        catch (WrongExpectedVersionException ex)
        {
            throw new Exception($"Concurrency error saving aggregate {aggregate.Id}", ex);
        }

        aggregate.MarkEventsAsCommitted();
    }
    private static string GetStreamName(Type t, Guid id) => $"{t.Name}-{id}";
}