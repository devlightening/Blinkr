using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

public class PostLikedConsumer : IConsumer<PostLikedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostLikedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostLikedConsumer(IMongoDatabase database, ILogger<PostLikedConsumer> logger, ProjectionInbox inbox)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostLikedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostLikedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName))
        {
            return;
        }

        var message = context.Message;
        _logger.LogInformation(
            "WS-07-LIKE-TOGGLE-FULL-FIX: Received PostLikedIntegrationEvent for PostId: {PostId}, LikerId: {LikerId}",
            message.PostId, message.LikerUserId);

        try
        {
            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId);
            var update = Builders<PostDocument>.Update.Inc(p => p.LikeCount, 1);

            var result = await _postsCollection.UpdateOneAsync(filter, update);

            if (result.MatchedCount == 0)
            {
                _logger.LogWarning(
                    "WS-07-LIKE-TOGGLE-FULL-FIX: Post not found for PostId: {PostId}",
                    message.PostId);
            }
            else
            {
                _logger.LogInformation(
                    "WS-07-LIKE-TOGGLE-FULL-FIX: Successfully incremented like count for PostId: {PostId}",
                    message.PostId);
            }

            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "WS-07-LIKE-TOGGLE-FULL-FIX: Error processing PostLikedIntegrationEvent for PostId: {PostId}",
                message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}
