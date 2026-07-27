using BlogService.Application.Common.Interfaces;
using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Entities;
using BlogService.Domain.Events;
using BlogService.Infrastructure.Data;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Shared.Events.Abstractions;
using Shared.Events.Events.Blog;

namespace BlogService.Infrastructure.Repositories;

/// <summary>
/// Decorator that publishes domain events to RabbitMQ after saving to EventStore
/// </summary>
public class EventStorePublishingDecorator : IEventStoreRepository
{
    private readonly IEventStoreRepository _inner;
    private readonly IBus _bus;
    private readonly BlogDbContext _dbContext;
    private readonly ILogger<EventStorePublishingDecorator> _log;

    public EventStorePublishingDecorator(
        IEventStoreRepository inner,
        IBus bus,
        BlogDbContext dbContext,
        ILogger<EventStorePublishingDecorator> log)
    {
        _inner = inner;
        _bus = bus;
        _dbContext = dbContext;
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
                await PublishToRabbitMqAsync(aggregate, domainEvent, ct);
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

    private async Task PublishToRabbitMqAsync(IAggregateRoot aggregate, IDomainEvent domainEvent, CancellationToken ct)
    {
        switch (domainEvent)
        {
            case PostCreatedEvent e:
            {
                _log.LogInformation("WS-07-LIKE-TOGGLE-CLEAN-ARCH: Publishing PostCreated PostId={PostId}", e.PostId);
                
                // Persist to Postgres (best effort, don't fail if DB error)
                try
                {
                    var post = new Post
                    {
                        Id = e.PostId,
                        AuthorId = e.AuthorId,
                        Title = e.Title,
                        Content = e.Content,
                        Latitude = e.Latitude,
                        Longitude = e.Longitude,
                        AccuracyMeters = e.AccuracyMeters,
                        LocationName = e.LocationName,
                        PlaceId = e.PlaceId,
                        SignalType = e.SignalType,
                        SignalValue = e.SignalValue,
                        AudienceType = e.AudienceType,
                        IdentityDisclosure = e.IdentityDisclosure,
                        LocationPrecision = e.LocationPrecision,
                        SourceType = e.SourceType,
                        ExpiresAt = e.ExpiresAt,
                        CreatedAt = e.OccurredOn,
                        CreatedBy = e.AuthorId
                    };
                    _dbContext.Posts.Add(post);
                    await _dbContext.SaveChangesAsync(ct);
                }
                catch (Exception ex)
                {
                    _log.LogError(ex, "WS-07-LIKE-TOGGLE-CLEAN-ARCH: Failed to persist Post to Postgres");
                }
                
                // Get media from aggregate if available
                var postAggregate = aggregate as PostAggregate;
                var mediaList = postAggregate?.Media?.Select(m => new PostMediaDto 
                { 
                    Url = m.Url, 
                    MediaType = m.Type.ToString() 
                }).ToList();
                
                await _bus.Publish<IPostCreatedIntegrationEvent>(new
                {
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
                    Media = mediaList
                }, ct);
                break;
            }

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
            {
                var post = (PostAggregate)aggregate;
                _log.LogInformation(
                    "WS-07-LIKE-TOGGLE-CLEAN-ARCH: Publishing PostLikedIntegrationEvent PostId={PostId}, PostOwnerId={PostOwnerId}, LikerId={LikerId}",
                    post.Id, post.AuthorId, e.UserId);
                
                // Persist to Postgres
                var postLike = new PostLike
                {
                    Id = Guid.NewGuid(),
                    PostId = post.Id,
                    UserId = e.UserId,
                    LikedAtUtc = e.OccurredOn
                };
                _dbContext.PostLikes.Add(postLike);
                await _dbContext.SaveChangesAsync(ct);
                
                await _bus.Publish(new PostLikedIntegrationEvent
                {
                    PostId = post.Id,
                    PostOwnerId = post.AuthorId,
                    LikerUserId = e.UserId,
                    LikerUserName = "Unknown",
                    OccurredAtUtc = e.OccurredOn
                }, ct);
                break;
            }

            case PostUnlikedEvent e:
            {
                var post = (PostAggregate)aggregate;
                _log.LogInformation(
                    "WS-07-LIKE-TOGGLE-CLEAN-ARCH: Publishing PostUnlikedIntegrationEvent PostId={PostId}, PostOwnerId={PostOwnerId}, LikerId={LikerId}",
                    post.Id, post.AuthorId, e.UserId);
                
                // Remove from Postgres
                var postLike = await _dbContext.PostLikes
                    .FirstOrDefaultAsync(x => x.PostId == post.Id && x.UserId == e.UserId, ct);
                if (postLike != null)
                {
                    _dbContext.PostLikes.Remove(postLike);
                    await _dbContext.SaveChangesAsync(ct);
                }
                
                await _bus.Publish(new PostUnlikedIntegrationEvent
                {
                    PostId = post.Id,
                    PostOwnerId = post.AuthorId,
                    LikerUserId = e.UserId,
                    OccurredAtUtc = e.OccurredOn
                }, ct);
                break;
            }

            case PostCommentAddedEvent e:
            {
                var post = (PostAggregate)aggregate;
                _log.LogInformation(
                    "WS-07-LIKE-TOGGLE-CLEAN-ARCH: Publishing PostCommentAddedIntegrationEvent PostId={PostId}, PostOwnerId={PostOwnerId}, CommentId={CommentId}",
                    post.Id, post.AuthorId, e.CommentId);
                
                // Persist to Postgres
                var postComment = new PostComment
                {
                    Id = e.CommentId,
                    PostId = post.Id,
                    AuthorId = e.AuthorId,
                    CommentText = e.CommentText,
                    CreatedAtUtc = e.OccurredOn,
                    ParentCommentId = null
                };
                _dbContext.PostComments.Add(postComment);
                await _dbContext.SaveChangesAsync(ct);
                
                await _bus.Publish(new PostCommentAddedIntegrationEvent
                {
                    PostId = post.Id,
                    PostOwnerId = post.AuthorId,
                    CommentId = e.CommentId,
                    CommentAuthorId = e.AuthorId,
                    CommentAuthorName = "Unknown",
                    CommentText = e.CommentText,
                    OccurredAtUtc = e.OccurredOn
                }, ct);
                break;
            }

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
