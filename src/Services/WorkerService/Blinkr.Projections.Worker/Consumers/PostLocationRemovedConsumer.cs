using MassTransit;
using MongoDB.Driver;
using Shared.Events.Abstractions;
using Blinkr.Projections.Worker.Documents;

namespace Blinkr.Projections.Worker.Consumers;

/// <summary>
/// Consumer for post location removed integration events
/// </summary>
public class PostLocationRemovedConsumer : IConsumer<IPostLocationRemovedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _collection;
    private readonly ILogger<PostLocationRemovedConsumer> _logger;

    public PostLocationRemovedConsumer(IMongoDatabase database, ILogger<PostLocationRemovedConsumer> logger)
    {
        _collection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<IPostLocationRemovedIntegrationEvent> context)
    {
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
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "❌ Failed to project LocationRemoved. PostId={PostId}", message.PostId);
            throw;
        }
    }
}
