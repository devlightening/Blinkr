using Blinkr.Projections.Worker.Documents;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

public class PostDeletedConsumer : IConsumer<PostDeletedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostDeletedConsumer> _logger;

    public PostDeletedConsumer(IMongoDatabase database, ILogger<PostDeletedConsumer> logger)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<PostDeletedIntegrationEvent> context)
    {
        var message = context.Message;
        _logger.LogInformation("Received PostDeletedIntegrationEvent for PostId: {PostId}", message.PostId);

        try
        {
            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId);
            var result = await _postsCollection.DeleteOneAsync(filter);

            if (result.DeletedCount == 0)
            {
                _logger.LogWarning("Post not found for deletion, PostId: {PostId}", message.PostId);
            }
            else
            {
                _logger.LogInformation("Successfully deleted PostId: {PostId} from read model", message.PostId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PostDeletedIntegrationEvent for PostId: {PostId}", message.PostId);
            throw;
        }
    }
}
