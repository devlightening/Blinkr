using System.Text.Json;
using BlogService.Domain.Events;
using BlogService.Infrastructure;
using EventStore.Client;
using MassTransit;
using MongoDB.Bson;
using MongoDB.Driver;
using Shared.Events.Abstractions;
using Shared.Events.Events.Blog;

namespace BlogService.Api;

public sealed class EventStoreToRabbitMqPublisher : BackgroundService
{
    private const string AggregateStreamPrefix = "PostAggregate-";
    private const string CheckpointKey = "publisher-posts";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private static readonly Dictionary<string, Type> DomainTypesByName =
        new(StringComparer.OrdinalIgnoreCase)
        {
            [nameof(PostCreatedEvent)] = typeof(PostCreatedEvent),
            [nameof(PostContentUpdatedEvent)] = typeof(PostContentUpdatedEvent),
            [nameof(PostDeletedEvent)] = typeof(PostDeletedEvent),
            [nameof(PostLikedEvent)] = typeof(PostLikedEvent),
            [nameof(PostUnlikedEvent)] = typeof(PostUnlikedEvent),
            [nameof(PostCommentAddedEvent)] = typeof(PostCommentAddedEvent),
            [nameof(PostLocationAddedEvent)] = typeof(PostLocationAddedEvent),
            [nameof(PostLocationUpdatedEvent)] = typeof(PostLocationUpdatedEvent),
            [nameof(PostLocationRemovedEvent)] = typeof(PostLocationRemovedEvent),
        };

    private readonly EventStoreClient _es;
    private readonly IBus _bus;
    private readonly ICheckpointStore _checkpointStore;
    private readonly IMongoCollection<BsonDocument> _statusCollection;
    private readonly IMongoCollection<BsonDocument> _failureCollection;
    private readonly ILogger<EventStoreToRabbitMqPublisher> _log;

    public EventStoreToRabbitMqPublisher(
        EventStoreClient es,
        IBus bus,
        ICheckpointStore checkpointStore,
        IMongoDatabase mongoDatabase,
        ILogger<EventStoreToRabbitMqPublisher> log)
    {
        _es = es;
        _bus = bus;
        _checkpointStore = checkpointStore;
        _statusCollection = mongoDatabase.GetCollection<BsonDocument>("publisher_status");
        _failureCollection = mongoDatabase.GetCollection<BsonDocument>("publisher_failures");
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("BLK-INFRA-01 EventStore publisher starting");

        var backoff = TimeSpan.FromSeconds(1);
        var maxBackoff = TimeSpan.FromSeconds(30);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var checkpoint = await _checkpointStore.GetAsync(CheckpointKey, stoppingToken);
                var start = checkpoint.HasValue ? FromAll.After(checkpoint.Value) : FromAll.Start;

                await WriteStatusAsync("starting", checkpoint, null, stoppingToken);
                _log.LogInformation(
                    "EventStore subscription starting. Prefix={Prefix} Start={Start}",
                    AggregateStreamPrefix,
                    checkpoint.HasValue ? "checkpoint" : "start");

                var dropped = new TaskCompletionSource<object?>(
                    TaskCreationOptions.RunContinuationsAsynchronously);

                using var subscription = await _es.SubscribeToAllAsync(
                    start: start,
                    eventAppeared: async (_, resolved, ct) => await HandleEventAsync(resolved, ct),
                    resolveLinkTos: false,
                    subscriptionDropped: (_, reason, ex) =>
                    {
                        if (ex is null)
                        {
                            _log.LogWarning("EventStore subscription dropped. Reason={Reason}", reason);
                        }
                        else
                        {
                            _log.LogWarning(ex, "EventStore subscription dropped. Reason={Reason}", reason);
                        }

                        dropped.TrySetResult(null);
                    },
                    filterOptions: new SubscriptionFilterOptions(StreamFilter.Prefix(AggregateStreamPrefix)),
                    cancellationToken: stoppingToken);

                await WriteStatusAsync("running", checkpoint, null, stoppingToken);
                backoff = TimeSpan.FromSeconds(1);

                await dropped.Task.WaitAsync(stoppingToken);

                if (!stoppingToken.IsCancellationRequested)
                {
                    await WriteStatusAsync("dropped", checkpoint, "subscription ended", stoppingToken);
                    await Task.Delay(backoff, stoppingToken);
                    backoff = IncreaseBackoff(backoff, maxBackoff);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "EventStore publisher loop failed. Retrying after {DelaySeconds}s", backoff.TotalSeconds);
                await WriteStatusAsync("retrying", null, ex.Message, CancellationToken.None);
                await Task.Delay(backoff, stoppingToken);
                backoff = IncreaseBackoff(backoff, maxBackoff);
            }
        }

        await WriteStatusAsync("stopped", null, null, CancellationToken.None);
        _log.LogInformation("BLK-INFRA-01 EventStore publisher stopped");
    }

    private async Task HandleEventAsync(ResolvedEvent resolved, CancellationToken ct)
    {
        if (resolved.OriginalPosition is not Position position)
        {
            _log.LogDebug("Skipping event without original all-stream position. Stream={Stream}", resolved.OriginalStreamId);
            return;
        }

        if (resolved.Event.EventType.StartsWith("$", StringComparison.Ordinal))
        {
            await StoreCheckpointAsync(position, ct);
            return;
        }

        if (ResolveDomainType(resolved.Event.EventType) is not { } eventType)
        {
            await StorePoisonEventAsync(resolved, "unknown_event_type", null, ct);
            await StoreCheckpointAsync(position, ct);
            return;
        }

        object? domainEvent;
        try
        {
            domainEvent = JsonSerializer.Deserialize(resolved.Event.Data.Span, eventType, JsonOpts);
        }
        catch (JsonException ex)
        {
            await StorePoisonEventAsync(resolved, "deserialize_failed", ex.Message, ct);
            await StoreCheckpointAsync(position, ct);
            return;
        }

        if (domainEvent is null)
        {
            await StorePoisonEventAsync(resolved, "deserialize_null", null, ct);
            await StoreCheckpointAsync(position, ct);
            return;
        }

        await PublishIntegrationEventAsync(domainEvent, resolved.Event.EventId.ToGuid(), ct);
        await StoreCheckpointAsync(position, ct);
        await WriteStatusAsync("running", position, null, ct);
    }

    private async Task PublishIntegrationEventAsync(object domainEvent, Guid eventId, CancellationToken ct)
    {
        switch (domainEvent)
        {
            case PostCreatedEvent e:
                await _bus.Publish<IPostCreatedIntegrationEvent>(new
                {
                    Id = eventId,
                    e.PostId,
                    e.AuthorId,
                    e.Title,
                    e.Content,
                    e.OccurredOn,
                    e.AuthorName,
                    e.AuthorGender,
                    e.Latitude,
                    e.Longitude,
                    e.AccuracyMeters,
                    e.LocationName,
                    e.PlaceId,
                    e.SignalType,
                    e.SignalValue,
                    e.AudienceType,
                    e.IdentityDisclosure,
                    e.LocationPrecision,
                    e.SourceType,
                    e.ExpiresAt,
                    Media = e.Media?
                        .Select(m => new Shared.Events.Abstractions.PostMediaInfo
                        {
                            MediaId = m.MediaId,
                            Url = m.Url,
                            MediaType = m.MediaType,
                            ContentType = m.ContentType,
                            SizeBytes = m.SizeBytes,
                            Width = m.Width,
                            Height = m.Height,
                            DurationSeconds = m.DurationSeconds,
                            ThumbnailUrl = m.ThumbnailUrl
                        })
                        .ToList()
                }, ctx => ctx.MessageId = eventId, ct);
                _log.LogInformation("Published PostCreatedIntegrationEvent EventId={EventId} PostId={PostId}", eventId, e.PostId);
                return;

            case PostContentUpdatedEvent e:
                await _bus.Publish(new PostContentUpdatedIntegrationEvent
                {
                    Id = eventId,
                    OccurredOn = e.OccurredOn,
                    PostId = e.PostId,
                    NewTitle = e.NewTitle,
                    NewContent = e.NewContent
                }, ctx => ctx.MessageId = eventId, ct);
                _log.LogInformation("Published PostContentUpdatedIntegrationEvent EventId={EventId} PostId={PostId}", eventId, e.PostId);
                return;

            case PostDeletedEvent e:
                await _bus.Publish(new PostDeletedIntegrationEvent
                {
                    Id = eventId,
                    OccurredOn = e.OccurredOn,
                    PostId = e.PostId
                }, ctx => ctx.MessageId = eventId, ct);
                _log.LogInformation("Published PostDeletedIntegrationEvent EventId={EventId} PostId={PostId}", eventId, e.PostId);
                return;

            case PostLikedEvent e:
                await _bus.Publish(new PostLikedIntegrationEvent
                {
                    Id = eventId,
                    OccurredOn = e.OccurredOn,
                    PostId = e.PostId,
                    LikerUserId = e.UserId,
                    OccurredAtUtc = e.OccurredOn
                }, ctx => ctx.MessageId = eventId, ct);
                _log.LogInformation("Published PostLikedIntegrationEvent EventId={EventId} PostId={PostId}", eventId, e.PostId);
                return;

            case PostUnlikedEvent e:
                await _bus.Publish(new PostUnlikedIntegrationEvent
                {
                    Id = eventId,
                    OccurredOn = e.OccurredOn,
                    PostId = e.PostId,
                    LikerUserId = e.UserId,
                    OccurredAtUtc = e.OccurredOn
                }, ctx => ctx.MessageId = eventId, ct);
                _log.LogInformation("Published PostUnlikedIntegrationEvent EventId={EventId} PostId={PostId}", eventId, e.PostId);
                return;

            case PostCommentAddedEvent e:
                await _bus.Publish(new PostCommentAddedIntegrationEvent
                {
                    Id = eventId,
                    OccurredOn = e.OccurredOn,
                    PostId = e.PostId,
                    CommentId = e.CommentId,
                    CommentAuthorId = e.AuthorId,
                    CommentText = e.CommentText,
                    OccurredAtUtc = e.OccurredOn
                }, ctx => ctx.MessageId = eventId, ct);
                _log.LogInformation("Published PostCommentAddedIntegrationEvent EventId={EventId} PostId={PostId}", eventId, e.PostId);
                return;

            case PostLocationAddedEvent e:
                await _bus.Publish<IPostLocationAddedIntegrationEvent>(new
                {
                    Id = eventId,
                    e.PostId,
                    Lat = e.Latitude,
                    Lon = e.Longitude,
                    Name = e.LocationName,
                    e.OccurredOn
                }, ctx => ctx.MessageId = eventId, ct);
                _log.LogInformation("Published PostLocationAddedIntegrationEvent EventId={EventId} PostId={PostId}", eventId, e.PostId);
                return;

            case PostLocationUpdatedEvent e:
                await _bus.Publish<IPostLocationUpdatedIntegrationEvent>(new
                {
                    Id = eventId,
                    e.PostId,
                    Lat = e.Latitude,
                    Lon = e.Longitude,
                    Name = e.LocationName,
                    e.OccurredOn
                }, ctx => ctx.MessageId = eventId, ct);
                _log.LogInformation("Published PostLocationUpdatedIntegrationEvent EventId={EventId} PostId={PostId}", eventId, e.PostId);
                return;

            case PostLocationRemovedEvent e:
                await _bus.Publish<IPostLocationRemovedIntegrationEvent>(new
                {
                    Id = eventId,
                    e.PostId,
                    e.OccurredOn
                }, ctx => ctx.MessageId = eventId, ct);
                _log.LogInformation("Published PostLocationRemovedIntegrationEvent EventId={EventId} PostId={PostId}", eventId, e.PostId);
                return;

            default:
                _log.LogDebug("Domain event has no integration mapping. EventType={EventType}", domainEvent.GetType().Name);
                return;
        }
    }

    private async Task StoreCheckpointAsync(Position position, CancellationToken ct)
    {
        await _checkpointStore.StoreAsync(CheckpointKey, position, ct);
        _log.LogDebug("Publisher checkpoint stored Commit={Commit} Prepare={Prepare}", position.CommitPosition, position.PreparePosition);
    }

    private async Task StorePoisonEventAsync(ResolvedEvent resolved, string reason, string? error, CancellationToken ct)
    {
        var id = $"{resolved.OriginalStreamId}:{resolved.Event.EventNumber}";
        var doc = new BsonDocument
        {
            ["_id"] = id,
            ["stream"] = resolved.OriginalStreamId,
            ["eventType"] = resolved.Event.EventType,
            ["reason"] = reason,
            ["error"] = error is null ? BsonNull.Value : new BsonString(error),
            ["seenAtUtc"] = DateTime.UtcNow
        };

        await _failureCollection.ReplaceOneAsync(
            Builders<BsonDocument>.Filter.Eq("_id", id),
            doc,
            new ReplaceOptions { IsUpsert = true },
            ct);

        _log.LogError(
            "Poison EventStore event recorded and skipped. Stream={Stream} EventType={EventType} Reason={Reason}",
            resolved.OriginalStreamId,
            resolved.Event.EventType,
            reason);
    }

    private async Task WriteStatusAsync(string state, Position? checkpoint, string? lastError, CancellationToken ct)
    {
        BsonValue lastErrorValue = lastError is null ? BsonNull.Value : new BsonString(lastError);
        var update = Builders<BsonDocument>.Update
            .Set("state", state)
            .Set("updatedAtUtc", DateTime.UtcNow)
            .Set("lastError", lastErrorValue);

        if (checkpoint.HasValue)
        {
            update = update
                .Set("commit", ToBson(checkpoint.Value.CommitPosition))
                .Set("prepare", ToBson(checkpoint.Value.PreparePosition));
        }

        await _statusCollection.UpdateOneAsync(
            Builders<BsonDocument>.Filter.Eq("_id", CheckpointKey),
            update,
            new UpdateOptions { IsUpsert = true },
            ct);
    }

    private static BsonValue ToBson(ulong value) =>
        value <= long.MaxValue ? new BsonInt64((long)value) : new BsonString(value.ToString());

    private static TimeSpan IncreaseBackoff(TimeSpan current, TimeSpan max)
    {
        var increased = TimeSpan.FromSeconds(current.TotalSeconds * 2);
        return increased < max ? increased : max;
    }

    private static Type? ResolveDomainType(string eventTypeName)
    {
        if (string.IsNullOrWhiteSpace(eventTypeName)) return null;

        var type = Type.GetType(eventTypeName, throwOnError: false, ignoreCase: true);
        if (type is not null) return type;

        var simple = eventTypeName.Contains('.') ? eventTypeName.Split('.').Last() : eventTypeName;
        return DomainTypesByName.TryGetValue(simple, out var mapped) ? mapped : null;
    }
}
