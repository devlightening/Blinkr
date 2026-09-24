using BlogService.Application.Common.Interfaces;
using BlogService.Application.Services;
using BlogService.Domain.Entities;
using BlogService.Infrastructure.ReadModels;
using MassTransit;
using MongoDB.Bson;
using MongoDB.Driver;
using Shared.Events.Events.Blog;
using Shared.Events.Events.Identity;

namespace BlogService.Api.Consumers;

/// <summary>
/// Erases everything BlogService holds for a deleted account (plan-devam F3, P10.7): the person's signals go through
/// the normal event-sourced delete (PostDeleted), so the projection, the map, the feed and the place state all drop
/// them; their comments and likes on other people's signals are removed the same way; view records and uploaded media
/// files are deleted. Idempotent: a repeated event finds nothing left to do.
/// </summary>
public sealed class UserDeletedConsumer : IConsumer<UserDeletedIntegrationEvent>
{
    private readonly IEventStoreRepository _events;
    private readonly IPublishEndpoint _bus;
    private readonly IMediaAttachmentService _media;
    private readonly IMongoDatabase _database;
    private readonly ILogger<UserDeletedConsumer> _logger;

    public UserDeletedConsumer(IEventStoreRepository events, IPublishEndpoint bus, IMediaAttachmentService media, IMongoDatabase database, ILogger<UserDeletedConsumer> logger)
    {
        _events = events;
        _bus = bus;
        _media = media;
        _database = database;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<UserDeletedIntegrationEvent> context)
    {
        var userId = context.Message.UserId;
        var ct = context.CancellationToken;
        if (userId == Guid.Empty) return;

        var posts = _database.GetCollection<PostDocument>("posts");
        var moderated = _database.GetCollection<PostDocument>("posts_moderated");

        // 1. Their own signals (visible and moderated ones).
        var own = new List<Guid>();
        foreach (var collection in new[] { posts, moderated })
            own.AddRange(await collection.Find(p => p.AuthorId == userId).Project(p => p.Id).ToListAsync(ct));
        var deleted = 0;
        foreach (var postId in own.Distinct())
        {
            var post = await _events.LoadAsync<PostAggregate>(postId, ct);
            if (post.Version < 0 || post.IsDeleted) continue;
            post.Delete();
            await _events.SaveAsync(post, ct);
            await _bus.Publish(new PostDeletedIntegrationEvent { PostId = post.Id }, ct);
            deleted++;
        }

        // 2. Their comments and likes on other people's signals, removed on the aggregate (the source of truth).
        var touched = await posts.Find(Builders<PostDocument>.Filter.Or(
                Builders<PostDocument>.Filter.ElemMatch(p => p.Comments, c => c.AuthorId == userId),
                Builders<PostDocument>.Filter.AnyEq(p => p.LikedByUserIds, userId)))
            .Project(p => p.Id).ToListAsync(ct);
        var comments = 0;
        var likes = 0;
        foreach (var postId in touched.Except(own))
        {
            var post = await _events.LoadAsync<PostAggregate>(postId, ct);
            if (post.Version < 0 || post.IsDeleted) continue;
            foreach (var comment in post.Comments.Where(c => c.AuthorId == userId).ToList())
            {
                post.RemoveComment(comment.Id, userId);
                comments++;
            }
            if (post.Likes.Any(l => l.UserId == userId))
            {
                post.UnlikePost(userId);
                likes++;
            }
            await _events.SaveAsync(post, ct);
        }

        // 3. View records ("{postId}:{userId}:{day}") and uploaded media files.
        var views = await _database.GetCollection<BsonDocument>("post_views")
            .DeleteManyAsync(Builders<BsonDocument>.Filter.Regex("_id", new BsonRegularExpression($"^[^:]+:{userId}:")), ct);
        var files = await _media.DeleteAllForOwnerAsync(userId, ct);

        _logger.LogInformation(
            "Account erased in BlogService | UserId={UserId} | Posts={Posts} | Comments={Comments} | Likes={Likes} | Views={Views} | Media={Media}",
            userId, deleted, comments, likes, views.DeletedCount, files);
    }
}
