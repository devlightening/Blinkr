using MassTransit;
using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;
using Shared.Events.Abstractions;
using Blinkr.Projections.Worker.Documents;

namespace Blinkr.Projections.Worker.Consumers;

/// <summary>
/// Consumer for post location added integration events
/// </summary>
public class PostLocationAddedConsumer : IConsumer<IPostLocationAddedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _collection;
    private readonly ILogger<PostLocationAddedConsumer> _logger;

    public PostLocationAddedConsumer(IMongoDatabase database, ILogger<PostLocationAddedConsumer> logger)
    {
        _collection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<IPostLocationAddedIntegrationEvent> context)
    {
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
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "❌ Failed to project LocationAdded. PostId={PostId}", message.PostId);
            throw;
        }
    }
}
