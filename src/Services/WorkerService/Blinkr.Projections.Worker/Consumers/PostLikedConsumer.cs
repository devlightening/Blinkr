using Blinkr.Projections.Worker.Documents;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

public class PostLikedConsumer : IConsumer<PostLikedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostLikedConsumer> _logger;

    public PostLikedConsumer(IMongoDatabase database, ILogger<PostLikedConsumer> logger)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<PostLikedIntegrationEvent> context)
    {
        var message = context.Message;
        _logger.LogInformation("Received PostLikedIntegrationEvent for PostId: {PostId}, UserId: {UserId}", 
            message.PostId, message.UserId);

        try
        {
            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId);
            var update = Builders<PostDocument>.Update.Inc(p => p.LikeCount, 1);

            var result = await _postsCollection.UpdateOneAsync(filter, update);

            if (result.MatchedCount == 0)
            {
                _logger.LogWarning("Post not found for PostId: {PostId}", message.PostId);
            }
            else
            {
                _logger.LogInformation("Successfully incremented like count for PostId: {PostId}", message.PostId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PostLikedIntegrationEvent for PostId: {PostId}", message.PostId);
            throw;
        }
    }
}
