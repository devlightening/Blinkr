using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

public class PostContentUpdatedConsumer : IConsumer<PostContentUpdatedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostContentUpdatedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostContentUpdatedConsumer(IMongoDatabase database, ILogger<PostContentUpdatedConsumer> logger, ProjectionInbox inbox)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostContentUpdatedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostContentUpdatedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName))
        {
            return;
        }

        var message = context.Message;
        _logger.LogInformation("Received PostContentUpdatedIntegrationEvent for PostId: {PostId}", message.PostId);

        try
        {
            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId);
            var updateBuilder = Builders<PostDocument>.Update;
            
            var updates = new List<UpdateDefinition<PostDocument>>();
            
            if (!string.IsNullOrWhiteSpace(message.NewTitle))
            {
                updates.Add(updateBuilder.Set(p => p.Title, message.NewTitle));
            }
            
            if (!string.IsNullOrWhiteSpace(message.NewContent))
            {
                updates.Add(updateBuilder.Set(p => p.Content, message.NewContent));
            }

            if (updates.Count == 0)
            {
                _logger.LogWarning("No updates to apply for PostId: {PostId}", message.PostId);
                await _inbox.MarkProcessedAsync(context, consumerName);
                return;
            }

            var update = updateBuilder.Combine(updates);
            var result = await _postsCollection.UpdateOneAsync(filter, update);

            if (result.MatchedCount == 0)
            {
                _logger.LogWarning("Post not found for PostId: {PostId}", message.PostId);
            }
            else
            {
                _logger.LogInformation("Successfully updated content for PostId: {PostId}", message.PostId);
            }

            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PostContentUpdatedIntegrationEvent for PostId: {PostId}", message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}
