using System.Text.Json;
using EventStore.Client;
using MassTransit;
using BlogService.Domain.Events;
using Shared.Events.Events.Blog;
using Shared.Events.Abstractions;

namespace BlogService.Api;


public class EventStoreToRabbitMqPublisher : BackgroundService
{
    private readonly EventStoreClient _eventStoreClient;
    private readonly IBus _bus;
    private readonly ILogger<EventStoreToRabbitMqPublisher> _logger;

    // Sadece PostAggregate akışlarını dinleyeceğiz
    private const string AggregateStreamPrefix = "PostAggregate-";

    // JSON için ufak tolerans (case-insensitive vs.)
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public EventStoreToRabbitMqPublisher(
        EventStoreClient eventStoreClient,
        IBus bus,
        ILogger<EventStoreToRabbitMqPublisher> logger)
    {
        _eventStoreClient = eventStoreClient;
        _bus = bus;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogWarning("🚀 EventStoreDB Publisher is starting...");

        // TEMPORARY: Başlangıçtan itibaren tüm event'leri replay et (test için)
        // Production'da checkpoint-based subscription kullanılmalı
        var start = FromAll.Start;

        // Sadece PostAggregate-* stream'leri
        var filter = new SubscriptionFilterOptions(StreamFilter.Prefix(AggregateStreamPrefix));

        _logger.LogWarning("📡 Subscribing to EventStore with prefix: {Prefix}", AggregateStreamPrefix);

        // Aboneliği başlat
        await _eventStoreClient.SubscribeToAllAsync(
            start,
            eventAppeared: async (subscription, resolved, ct) =>
            {
                // İptal istenmişse çık
                if (ct.IsCancellationRequested) return;

                try
                {
                    // EventType, Save sırasında AssemblyQualifiedName olarak yazıldıysa doğrudan çözülebilir
                    var typeName = resolved.Event.EventType;
                    var eventType = Type.GetType(typeName);

                    if (eventType is null)
                    {
                        _logger.LogWarning("⚠️ Unknown event type '{EventType}' (assembly load?). Stream={StreamId}, Position={Position}",
                            typeName, resolved.OriginalStreamId, resolved.OriginalPosition);
                        return;
                    }

                    // Domain event'i deserialize et
                    var domainEvent = JsonSerializer.Deserialize(resolved.Event.Data.Span, eventType, JsonOpts);
                    if (domainEvent is null)
                    {
                        _logger.LogWarning("⚠️ Failed to deserialize event '{EventType}'. Stream={StreamId}, Position={Position}",
                            typeName, resolved.OriginalStreamId, resolved.OriginalPosition);
                        return;
                    }

                    // HER EVENT İÇİN LOG
                    _logger.LogWarning("📨 Event received: {EventType} from {StreamId} @ {Position}",
                        eventType.Name, resolved.OriginalStreamId, resolved.OriginalPosition);

                    // Sadece gerekli event'leri integration event'e çevirip yayınla
                    switch (domainEvent)
                    {
                        case PostCreatedEvent e:
                            _logger.LogWarning("🎯 Publishing IPostCreatedIntegrationEvent for PostId: {PostId}", e.PostId);

                            await _bus.Publish<IPostCreatedIntegrationEvent>(new
                            {
                                e.PostId,
                                e.AuthorId,
                                e.Title,
                                e.Content,
                                e.OccurredOn
                            }, ct).ConfigureAwait(false);

                            _logger.LogWarning("✅ Published to RabbitMQ!");
                            break;

                        // İleride: PostContentUpdatedEvent, PostDeletedEvent, PostLikedEvent vb.
                        default:
                            _logger.LogWarning("⏭️ Domain event '{EventType}' ignored (no publisher mapping).", eventType.Name);
                            break;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "❌ Error processing event. Stream={StreamId}, Position={Position}, EventType={EventType}",
                        resolved.OriginalStreamId, resolved.OriginalPosition, resolved.Event.EventType);
                }
            },
            // Sistem ($) event'ler prefix'e takılmadığı için ek filtre zorunlu değil; istersen buraya EventTypeFilter da koyabilirsin.
            filterOptions: filter,
            // Abonelik düştüğünde logla
            subscriptionDropped: (sub, reason, ex) =>
            {
                if (ex is not null)
                    _logger.LogError(ex, "💔 EventStoreDB subscription dropped. Reason={Reason}", reason);
                else
                    _logger.LogWarning("💔 EventStoreDB subscription dropped. Reason={Reason}", reason);
            },
            cancellationToken: stoppingToken
        ).ConfigureAwait(false);

        _logger.LogWarning("✅ EventStoreDB Publisher subscription started.");
    }
}
