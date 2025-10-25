using BlogService.Application.Common.Interfaces;
using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Events;
using MassTransit;
using Microsoft.Extensions.Logging;
using Shared.Events.Abstractions;

namespace BlogService.Infrastructure.Repositories;

/// <summary>
/// Decorator that publishes domain events to RabbitMQ after saving to EventStore
/// </summary>
public class EventStorePublishingDecorator : IEventStoreRepository
{
    private readonly IEventStoreRepository _inner;
    private readonly IBus _bus;
    private readonly ILogger<EventStorePublishingDecorator> _log;

    public EventStorePublishingDecorator(
        IEventStoreRepository inner,
        IBus bus,
        ILogger<EventStorePublishingDecorator> log)
    {
        _inner = inner;
        _bus = bus;
        _log = log;
    }

    public async Task SaveAsync(IAggregateRoot aggregate, CancellationToken ct = default)
    {
        // Get uncommitted events BEFORE saving (they'll be cleared after save)
        var events = aggregate.GetUncommittedEvents().ToList();

        // Save to EventStore first
        await _inner.SaveAsync(aggregate, ct);

        // Then publish to RabbitMQ
        foreach (var domainEvent in events)
        {
            try
            {
                await PublishToRabbitMqAsync(domainEvent, ct);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to publish event {EventType} to RabbitMQ", domainEvent.GetType().Name);
                // Don't throw - event is already saved to EventStore
            }
        }
    }

    public Task<T> LoadAsync<T>(Guid aggregateId, CancellationToken ct = default) 
        where T : IAggregateRoot, new()
    {
        return _inner.LoadAsync<T>(aggregateId, ct);
    }

    private async Task PublishToRabbitMqAsync(IDomainEvent domainEvent, CancellationToken ct)
    {
        switch (domainEvent)
        {
            case PostCreatedEvent e:
                _log.LogInformation("Publishing PostCreated PostId={PostId}", e.PostId);
                await _bus.Publish<IPostCreatedIntegrationEvent>(new
                {
                    e.PostId,
                    e.AuthorId,
                    e.Title,
                    e.Content,
                    e.OccurredOn
                }, ct);
                break;

            case PostContentUpdatedEvent e:
                _log.LogInformation("Publishing PostContentUpdated PostId={PostId}", e.PostId);
                await _bus.Publish(new Shared.Events.Events.Blog.PostContentUpdatedIntegrationEvent
                {
                    PostId = e.PostId,
                    NewTitle = e.NewTitle,
                    NewContent = e.NewContent,
                    OccurredOn = e.OccurredOn
                }, ct);
                break;

            case PostDeletedEvent e:
                _log.LogInformation("Publishing PostDeleted PostId={PostId}", e.PostId);
                await _bus.Publish(new PostDeletedEvent(e.PostId, e.OccurredOn), ct);
                break;

            case PostLikedEvent e:
                _log.LogInformation("Publishing PostLiked PostId={PostId} UserId={UserId}", e.PostId, e.UserId);
                await _bus.Publish(new PostLikedEvent(e.PostId, e.UserId, e.OccurredOn), ct);
                break;

            case PostCommentAddedEvent e:
                _log.LogInformation("Publishing PostCommentAdded PostId={PostId} CommentId={CommentId}", e.PostId, e.CommentId);
                await _bus.Publish(new PostCommentAddedEvent(e.PostId, e.CommentId, e.AuthorId, e.CommentText, e.OccurredOn), ct);
                break;

            case PostLocationAddedEvent e:
                _log.LogInformation("Publishing PostLocationAdded PostId={PostId} Lat={Lat} Lon={Lon}", e.PostId, e.Latitude, e.Longitude);
                await _bus.Publish<IPostLocationAddedIntegrationEvent>(new
                {
                    e.PostId,
                    e.Latitude,
                    e.Longitude,
                    e.LocationName,
                    e.OccurredOn
                }, ct);
                break;

            case PostLocationUpdatedEvent e:
                _log.LogInformation("Publishing PostLocationUpdated PostId={PostId} Lat={Lat} Lon={Lon}", e.PostId, e.Latitude, e.Longitude);
                await _bus.Publish<IPostLocationUpdatedIntegrationEvent>(new
                {
                    e.PostId,
                    e.Latitude,
                    e.Longitude,
                    e.LocationName,
                    e.OccurredOn
                }, ct);
                break;

            case PostLocationRemovedEvent e:
                _log.LogInformation("Publishing PostLocationRemoved PostId={PostId}", e.PostId);
                await _bus.Publish<IPostLocationRemovedIntegrationEvent>(new
                {
                    e.PostId,
                    e.OccurredOn
                }, ct);
                break;

            default:
                _log.LogDebug("Unmapped domain event: {EventType}", domainEvent.GetType().Name);
                break;
        }
    }
}
