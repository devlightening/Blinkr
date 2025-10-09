using BlogService.Domain.Common.Interfaces;
using EventStore.Client;
using Shared.Events.Bus;
using System.Text.Json;
using Shared.Events;
using Shared.Events.Events.Blog;
using BlogService.Domain.Events;

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
        var uncommitted = aggregate.GetUncommittedEvents().ToList();
        if (uncommitted.Count == 0) return;

        var eventDataBatch = uncommitted.Select(e =>
        {
            var type = e.GetType().AssemblyQualifiedName!;
            var data = JsonSerializer.SerializeToUtf8Bytes(e);
            var meta = JsonSerializer.SerializeToUtf8Bytes(new { occurredOn = e.OccurredOn });
            return new EventData(Uuid.NewUuid(), type, data, meta);
        });

        // Expected revision = version before new events were applied
        var expectedBeforeApply = aggregate.Version - (uncommitted.Count);

        if (expectedBeforeApply < 0)
        {
            // New stream
            await _client.AppendToStreamAsync(stream, StreamState.NoStream, eventDataBatch, cancellationToken: cancellationToken);
        }
        else
        {
            var expected = StreamRevision.FromInt64(expectedBeforeApply);
            await _client.AppendToStreamAsync(stream, expected, eventDataBatch, cancellationToken: cancellationToken);
        }

        // Publish integration events (temporary direct publish; replace with Outbox for reliability)
        foreach (var ie in MapToIntegrationEvents(uncommitted))
        {
            await _bus.PublishAsync(ie, routingKey: ie.GetType().Name, ct: cancellationToken);
        }

        aggregate.MarkEventsAsCommitted();
    }

    private static string GetStreamName<T>(Guid id) => $"{typeof(T).Name.ToLowerInvariant()}-{id}";
    private static string GetStreamName(Type t, Guid id) => $"{t.Name.ToLowerInvariant()}-{id}";

    private static IEnumerable<IIntegrationEvent> MapToIntegrationEvents(IEnumerable<IDomainEvent> events)
    {
        foreach (var e in events)
        {
            switch (e)
            {
                case PostCreatedEvent pc:
                    yield return new PostCreatedIntegrationEvent
                    {
                        PostId = pc.PostId,
                        AuthorId = pc.AuthorId,
                        Title = pc.Title
                    };
                    break;
                case PostCommentAddedEvent ca:
                    yield return new PostCommentAddedIntegrationEvent
                    {
                        PostId = ca.PostId,
                        CommentId = Guid.NewGuid(), // domain doesn't expose comment id; generate placeholder
                        AuthorId = ca.AuthorId,
                        CommentText = ca.CommentText
                    };
                    break;
                case PostLikedEvent pl:
                    yield return new PostLikedIntegrationEvent
                    {
                        PostId = pl.PostId,
                        UserId = pl.UserId
                    };
                    break;
            }
        }
    }
}

