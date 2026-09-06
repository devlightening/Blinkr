using MassTransit;
using MongoDB.Driver;
using Shared.Events.Abstractions;
using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Infra;

namespace Blinkr.Projections.Worker.Consumers;

/// <summary>
/// Consumer for post location removed integration events
/// </summary>
public class PostLocationRemovedConsumer : IConsumer<IPostLocationRemovedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _collection;
    private readonly ILogger<PostLocationRemovedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostLocationRemovedConsumer(IMongoDatabase database, ILogger<PostLocationRemovedConsumer> logger, ProjectionInbox inbox)
    {
        _collection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<IPostLocationRemovedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostLocationRemovedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName))
        {
            return;
        }

        var message = context.Message;
        
        try
        {
            var update = Builders<PostDocument>.Update
                .Unset(x => x.Location)
                .Unset(x => x.LocationName);

            var result = await _collection.UpdateOneAsync(
                x => x.Id == message.PostId, 
                update);

            _logger.LogInformation(
                "📍 LocationRemoved projected. PostId={PostId}, Matched={Matched}, Modified={Modified}",
                message.PostId, result.MatchedCount, result.ModifiedCount);
            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "❌ Failed to project LocationRemoved. PostId={PostId}", message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}
