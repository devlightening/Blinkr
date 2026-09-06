using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

public class PostDeletedConsumer : IConsumer<PostDeletedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostDeletedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostDeletedConsumer(IMongoDatabase database, ILogger<PostDeletedConsumer> logger, ProjectionInbox inbox)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostDeletedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostDeletedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName))
        {
            return;
        }

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

            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PostDeletedIntegrationEvent for PostId: {PostId}", message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}
