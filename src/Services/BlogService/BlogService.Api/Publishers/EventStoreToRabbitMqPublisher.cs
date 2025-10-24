using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EventStore.Client;
using MassTransit;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using BlogService.Domain.Events;
using Shared.Events.Abstractions;
using Shared.Events.Events.Blog;
using ResolvedEvent = EventStore.Client.ResolvedEvent;
using BlogService.Infrastructure;
using static EventStore.Client.StreamSubscription;

namespace BlogService.Api
{
    public sealed class EventStoreToRabbitMqPublisher : BackgroundService
    {
        private const string AggregateStreamPrefix = "PostAggregate-";
        private const string CheckpointKey = "publisher-posts";

        // checkpointInterval (ms) -- test için 30s, prod'da ihtiyaca göre ayarla
        private const int CheckpointIntervalMs = 30_000;

        private readonly EventStoreClient _es;
        private readonly IBus _bus;
        private readonly ICheckpointStore _checkpointStore;
        private readonly ILogger<EventStoreToRabbitMqPublisher> _log;

        // Son persist edilmiş checkpoint (guard için)
        private EventStore.Client.Position? _lastPersistedCheckpoint = null;
        private readonly object _checkpointLock = new();

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
                [nameof(PostCommentAddedEvent)] = typeof(PostCommentAddedEvent),
            };

        public EventStoreToRabbitMqPublisher(
            EventStoreClient es,
            IBus bus,
            ICheckpointStore checkpointStore,
            ILogger<EventStoreToRabbitMqPublisher> log)
        {
            _es = es ?? throw new ArgumentNullException(nameof(es));
            _bus = bus ?? throw new ArgumentNullException(nameof(bus));
            _checkpointStore = checkpointStore ?? throw new ArgumentNullException(nameof(checkpointStore));
            _log = log ?? throw new ArgumentNullException(nameof(log));
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _log.LogInformation("🚀 EventStoreDB Publisher starting...");

            // Exponential backoff configuration
            var backoff = TimeSpan.FromSeconds(1);
            var maxBackoff = TimeSpan.FromSeconds(30);
            var consecutiveRestarts = 0;
            const int MaxConsecutiveRestartsForAlert = 5;

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var last = await _checkpointStore.GetAsync(CheckpointKey, stoppingToken);

                    // Eğer checkpoint veritabanından alınmışsa onu _lastPersistedCheckpoint olarak başlat
                    if (last.HasValue)
                    {
                        lock (_checkpointLock)
                        {
                            _lastPersistedCheckpoint = last.Value;
                        }
                    }

                    // Start from checkpoint if available, otherwise from End for live subscription
                    var start = last.HasValue ? FromAll.After(last.Value) : FromAll.End;

                    var filter = new SubscriptionFilterOptions(
                        StreamFilter.Prefix(AggregateStreamPrefix),
                        checkpointInterval: CheckpointIntervalMs,
                        checkpointReached: async (sub, pos, ct) =>
                        {
                            try
                            {
                                // sadece gerçek değişiklikse persist et
                                var shouldPersist = false;
                                lock (_checkpointLock)
                                {
                                    if (!_lastPersistedCheckpoint.HasValue ||
                                        _lastPersistedCheckpoint.Value.CommitPosition != pos.CommitPosition ||
                                        _lastPersistedCheckpoint.Value.PreparePosition != pos.PreparePosition)
                                    {
                                        _lastPersistedCheckpoint = pos;
                                        shouldPersist = true;
                                    }
                                }

                                if (shouldPersist)
                                {
                                    await _checkpointStore.StoreAsync(CheckpointKey, pos, ct).ConfigureAwait(false);
                                    _log.LogDebug("Checkpoint (interval) stored: {Commit}/{Prepare}", pos.CommitPosition, pos.PreparePosition);
                                }
                                else
                                {
                                    _log.LogDebug("Checkpoint (interval) unchanged: {Commit}/{Prepare}", pos.CommitPosition, pos.PreparePosition);
                                }
                            }
                            catch (Exception ex)
                            {
                                _log.LogError(ex, "Failed to store checkpoint in checkpointReached callback");
                            }
                        });

                    _log.LogInformation("📡 Subscription starting (prefix={Prefix}, start={Start})", 
                        AggregateStreamPrefix, start == FromAll.End ? "End" : last.HasValue ? "Checkpoint" : "Start");
                    
                    // AWAIT subscription - bloklanır, sadece drop olduğunda devam eder
                    await _es.SubscribeToAllAsync(
                        start: start,
                        eventAppeared: async (sub, resolved, ct) => await HandleEventAsync(resolved, ct).ConfigureAwait(false),
                        resolveLinkTos: false,
                        subscriptionDropped: (sub, reason, ex) =>
                        {
                            // SADECE logla - exception throw etme! Outer loop restart yapar.
                            if (reason == SubscriptionDroppedReason.Disposed)
                            {
                                _log.LogInformation("🛑 Subscription disposed (normal shutdown)");
                            }
                            else if (ex is not null)
                            {
                                _log.LogWarning(ex, "💔 Subscription dropped. Reason={Reason}", reason);
                            }
                            else
                            {
                                _log.LogWarning("💔 Subscription dropped. Reason={Reason}", reason);
                            }
                        },
                        filterOptions: filter,
                        cancellationToken: stoppingToken
                    ).ConfigureAwait(false);

                    // Subscription ended - this should NOT happen for live subscriptions
                    // Only restart if cancellation NOT requested
                    if (!stoppingToken.IsCancellationRequested)
                    {
                        consecutiveRestarts++;
                        _log.LogWarning("⚠️ Subscription ended unexpectedly. Backing off {Backoff}s (restart #{Count})", 
                            backoff.TotalSeconds, consecutiveRestarts);
                        
                        if (consecutiveRestarts >= MaxConsecutiveRestartsForAlert)
                        {
                            _log.LogError("🚨 ALERT: Too many consecutive subscription restarts ({Count}) - possible EventStore issue!", consecutiveRestarts);
                        }
                        
                        // SAFETY: Minimum delay to prevent hot loops
                        var safeDelay = TimeSpan.FromSeconds(Math.Max(5, backoff.TotalSeconds));
                        await Task.Delay(safeDelay, stoppingToken).ConfigureAwait(false);
                        backoff = IncreaseBackoff(backoff, maxBackoff);
                    }
                }
                catch (Grpc.Core.RpcException ex) when (
                    ex.StatusCode == Grpc.Core.StatusCode.Unavailable ||
                    ex.StatusCode == Grpc.Core.StatusCode.DeadlineExceeded)
                {
                    consecutiveRestarts++;
                    _log.LogWarning(ex, "⚠️ EventStore gRPC transient error. Backing off {Backoff}s (restart #{Count})", 
                        backoff.TotalSeconds, consecutiveRestarts);
                    
                    if (consecutiveRestarts >= MaxConsecutiveRestartsForAlert)
                    {
                        _log.LogError("🚨 ALERT: Too many consecutive restarts ({Count}) - possible persistent failure!", consecutiveRestarts);
                    }
                    
                    await Task.Delay(backoff, stoppingToken).ConfigureAwait(false);
                    backoff = IncreaseBackoff(backoff, maxBackoff);
                }
                catch (System.Net.Http.HttpRequestException ex)
                {
                    consecutiveRestarts++;
                    _log.LogWarning(ex, "⚠️ EventStore HTTP connection error. Backing off {Backoff}s (restart #{Count})", 
                        backoff.TotalSeconds, consecutiveRestarts);
                    await Task.Delay(backoff, stoppingToken).ConfigureAwait(false);
                    backoff = IncreaseBackoff(backoff, maxBackoff);
                }
                catch (System.Net.Sockets.SocketException ex)
                {
                    consecutiveRestarts++;
                    _log.LogWarning(ex, "⚠️ EventStore socket error. Backing off {Backoff}s (restart #{Count})", 
                        backoff.TotalSeconds, consecutiveRestarts);
                    await Task.Delay(backoff, stoppingToken).ConfigureAwait(false);
                    backoff = IncreaseBackoff(backoff, maxBackoff);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    _log.LogInformation("🛑 Publisher shutting down gracefully");
                    break;
                }
                catch (Exception ex)
                {
                    consecutiveRestarts++;
                    _log.LogError(ex, "❌ Unexpected error in subscription loop. Backing off {Backoff}s (restart #{Count})", 
                        backoff.TotalSeconds, consecutiveRestarts);
                    
                    if (consecutiveRestarts >= MaxConsecutiveRestartsForAlert)
                    {
                        _log.LogError("🚨 ALERT: Too many consecutive restarts ({Count}) - check EventStore health!", consecutiveRestarts);
                    }
                    
                    await Task.Delay(backoff, stoppingToken).ConfigureAwait(false);
                    backoff = IncreaseBackoff(backoff, maxBackoff);
                }
            }

            _log.LogInformation("🛑 Publisher stopping.");
        }

        private static TimeSpan IncreaseBackoff(TimeSpan current, TimeSpan max)
        {
            var increased = TimeSpan.FromSeconds(current.TotalSeconds * 2);
            return increased < max ? increased : max;
        }

        private async Task HandleEventAsync(ResolvedEvent resolved, CancellationToken ct)
        {
            if (ct.IsCancellationRequested) return;

            try
            {
                var typeName = resolved.Event.EventType;
                if (string.IsNullOrWhiteSpace(typeName))
                {
                    _log.LogDebug("Event without type skipped");
                    return;
                }

                if (typeName.StartsWith("$", StringComparison.Ordinal))
                {
                    _log.LogTrace("System event skipped: {EventType}", typeName);
                    return;
                }

                var eventType = ResolveDomainType(typeName);
                if (eventType is null)
                {
                    _log.LogWarning("Unknown event type: {EventType}", typeName);
                    return;
                }

                var domainEvent = JsonSerializer.Deserialize(resolved.Event.Data.Span, eventType, JsonOpts);
                if (domainEvent is null)
                {
                    _log.LogWarning("Deserialize failed for {EventType}", typeName);
                    return;
                }

                switch (domainEvent)
                {
                    case PostCreatedEvent e:
                        _log.LogInformation("Publish PostCreated PostId={PostId}", e.PostId);
                        await _bus.Publish<IPostCreatedIntegrationEvent>(new
                        {
                            e.PostId,
                            e.AuthorId,
                            e.Title,
                            e.Content,
                            e.OccurredOn
                        }, ct).ConfigureAwait(false);
                        break;

                    case PostContentUpdatedEvent e:
                        _log.LogInformation("Publish PostContentUpdated PostId={PostId}", e.PostId);
                        await _bus.Publish(new PostContentUpdatedIntegrationEvent
                        {
                            PostId = e.PostId,
                            NewTitle = e.NewTitle,
                            NewContent = e.NewContent
                        }, ct).ConfigureAwait(false);
                        break;

                    case PostDeletedEvent e:
                        _log.LogInformation("Publish PostDeleted PostId={PostId}", e.PostId);
                        await _bus.Publish(new PostDeletedEvent(e.PostId, e.OccurredOn), ct).ConfigureAwait(false);
                        break;

                    case PostLikedEvent e:
                        _log.LogInformation("Publish PostLiked PostId={PostId} UserId={UserId}", e.PostId, e.UserId);
                        await _bus.Publish(new PostLikedEvent(e.PostId, e.UserId, e.OccurredOn), ct).ConfigureAwait(false);
                        break;

                    case PostCommentAddedEvent e:
                        _log.LogInformation("Publish PostCommentAdded PostId={PostId} CommentId={CommentId}", e.PostId, e.CommentId);
                        await _bus.Publish(new PostCommentAddedEvent(e.PostId, e.CommentId, e.AuthorId, e.CommentText, e.OccurredOn), ct).ConfigureAwait(false);
                        break;

                    default:
                        _log.LogDebug("Unmapped domain event: {EventType}", eventType.Name);
                        break;
                }

                if (resolved.OriginalPosition is EventStore.Client.Position p)
                {
                    try
                    {
                        var shouldPersist = false;
                        lock (_checkpointLock)
                        {
                            if (!_lastPersistedCheckpoint.HasValue ||
                                _lastPersistedCheckpoint.Value.CommitPosition != p.CommitPosition ||
                                _lastPersistedCheckpoint.Value.PreparePosition != p.PreparePosition)
                            {
                                _lastPersistedCheckpoint = p;
                                shouldPersist = true;
                            }
                        }

                        if (shouldPersist)
                        {
                            await _checkpointStore.StoreAsync(CheckpointKey, p, ct).ConfigureAwait(false);
                            _log.LogTrace("Checkpoint (event) stored: {Commit}/{Prepare}", p.CommitPosition, p.PreparePosition);
                        }
                        else
                        {
                            _log.LogTrace("Checkpoint (event) unchanged: {Commit}/{Prepare}", p.CommitPosition, p.PreparePosition);
                        }
                    }
                    catch (Exception ex)
                    {
                        _log.LogWarning(ex, "Failed to store checkpoint after processing event Stream={Stream} Pos={Pos} Type={Type} - will retry on next event",
                            resolved.OriginalStreamId, resolved.OriginalPosition, resolved.Event.EventType);
                        // Don't throw - event was successfully published to RabbitMQ
                        // Checkpoint will be retried on next event or interval checkpoint
                    }
                }
            }
            catch (JsonException jex)
            {
                _log.LogError(jex, "JSON deserialization error processing event {EventType}", resolved.Event.EventType);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "❌ Error processing event. Stream={Stream} Pos={Pos} Type={Type}",
                    resolved.OriginalStreamId, resolved.OriginalPosition, resolved.Event.EventType);
                throw;
            }
        }

        private static Type? ResolveDomainType(string eventTypeName)
        {
            if (string.IsNullOrWhiteSpace(eventTypeName)) return null;

            var t = Type.GetType(eventTypeName, throwOnError: false, ignoreCase: true);
            if (t is not null) return t;

            var simple = eventTypeName.Contains('.') ? eventTypeName.Split('.').Last() : eventTypeName;
            return DomainTypesByName.TryGetValue(simple, out var mapped) ? mapped : null;
        }
    }
}
