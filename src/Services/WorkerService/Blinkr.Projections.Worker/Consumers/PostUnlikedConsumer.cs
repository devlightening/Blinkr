using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

/// <summary>
/// Consumes PostUnlikedIntegrationEvent, published by EventStoreToRabbitMqPublisher whenever a like is
/// toggled off (BlogService.Api's single POST /api/posts/{id}/likes endpoint toggles both ways). Before
/// this consumer existed, that event was published but nothing ever picked it up - LikeCount only ever
/// went up, never back down, and IsLikedByCurrentUser had no way to tell the like had been undone.
/// </summary>
public class PostUnlikedConsumer : IConsumer<PostUnlikedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostUnlikedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostUnlikedConsumer(IMongoDatabase database, ILogger<PostUnlikedConsumer> logger, ProjectionInbox inbox)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostUnlikedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostUnlikedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName))
        {
            return;
        }

        var message = context.Message;
        _logger.LogInformation(
            "Received PostUnlikedIntegrationEvent for PostId: {PostId}, LikerId: {LikerId}",
            message.PostId, message.LikerUserId);

        try
        {
            // Always remove the liker id, even if the count is already at its floor - membership must
            // stay correct regardless of how the count got there.
            var pullFilter = Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId);
            var pullUpdate = Builders<PostDocument>.Update.Pull(p => p.LikedByUserIds, message.LikerUserId);
            var pullResult = await _postsCollection.UpdateOneAsync(pullFilter, pullUpdate);

            if (pullResult.MatchedCount == 0)
            {
                _logger.LogWarning("Post not found for PostId: {PostId}", message.PostId);
            }

            // Only decrement while there is something to decrement - a duplicate or out-of-order
            // unlike must never push the count below zero.
            var decrementFilter = Builders<PostDocument>.Filter.And(
                Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId),
                Builders<PostDocument>.Filter.Gt(p => p.LikeCount, 0));
            var decrementUpdate = Builders<PostDocument>.Update.Inc(p => p.LikeCount, -1);
            await _postsCollection.UpdateOneAsync(decrementFilter, decrementUpdate);

            _logger.LogInformation("Applied unlike for PostId: {PostId}", message.PostId);
            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PostUnlikedIntegrationEvent for PostId: {PostId}", message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}
