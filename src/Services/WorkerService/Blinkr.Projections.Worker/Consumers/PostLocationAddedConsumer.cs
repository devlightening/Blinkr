using MassTransit;
using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;
using Shared.Events.Abstractions;
using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Infra;

namespace Blinkr.Projections.Worker.Consumers;

/// <summary>
/// Consumer for post location added integration events
/// </summary>
public class PostLocationAddedConsumer : IConsumer<IPostLocationAddedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _collection;
    private readonly ILogger<PostLocationAddedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostLocationAddedConsumer(IMongoDatabase database, ILogger<PostLocationAddedConsumer> logger, ProjectionInbox inbox)
    {
        _collection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<IPostLocationAddedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostLocationAddedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName))
        {
            return;
        }

        var message = context.Message;
        
        try
        {
            // Create GeoJSON Point (note: longitude first, then latitude)
            var geoPoint = new GeoJsonPoint<GeoJson2DGeographicCoordinates>(
                new GeoJson2DGeographicCoordinates(message.Lon, message.Lat));

            var update = Builders<PostDocument>.Update
                .Set(x => x.Location, geoPoint)
                .Set(x => x.LocationName, message.Name);

            var result = await _collection.UpdateOneAsync(
                x => x.Id == message.PostId, 
                update);

            if (result.MatchedCount == 0)
            {
                _logger.LogWarning(
                    "⚠️ LocationAdded: Post not found. PostId={PostId} (event may have arrived before post creation)",
                    message.PostId);
            }
            else
            {
                _logger.LogInformation(
                    "📍 LocationAdded projected. PostId={PostId}, Lat={Lat}, Lon={Lon}, Name={Name}, Matched={Matched}, Modified={Modified}",
                    message.PostId, message.Lat, message.Lon, message.Name, result.MatchedCount, result.ModifiedCount);
            }

            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "❌ Failed to project LocationAdded. PostId={PostId}", message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}
