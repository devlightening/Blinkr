using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Entities;
using MassTransit;
using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;
using Microsoft.Extensions.Caching.Distributed;
using Shared.Events.Abstractions;
using Shared.Events.Events.Blog;
using Blinkr.Projections.Worker.Helpers;

namespace Blinkr.Projections.Worker.Consumers;

public class PostCreatedConsumer : IConsumer<IPostCreatedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostCreatedConsumer> _logger;
    private readonly IDistributedCache _cache;

    public PostCreatedConsumer(IMongoDatabase database, ILogger<PostCreatedConsumer> logger, IDistributedCache cache)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _cache = cache;
    }

    public async Task Consume(ConsumeContext<IPostCreatedIntegrationEvent> context)
    {
        var message = context.Message;
        var hasLocation = message.Latitude.HasValue && message.Longitude.HasValue;
        _logger.LogInformation("📥 Received PostCreatedIntegrationEvent for PostId: {PostId} HasLocation: {HasLocation}", 
            message.PostId, hasLocation);

        try
        {
            // LOG DATABASE & COLLECTION INFO
            var dbName = _postsCollection.Database.DatabaseNamespace.DatabaseName;
            var collName = _postsCollection.CollectionNamespace.CollectionName;
            _logger.LogInformation("🎯 Writing to MongoDB: Database={DbName}, Collection={CollName}", dbName, collName);

            // Create GeoJSON Point if location is provided
            GeoJsonPoint<GeoJson2DGeographicCoordinates>? location = null;
            if (message.Latitude.HasValue && message.Longitude.HasValue)
            {
                _logger.LogInformation("🗺️ Creating GeoJSON Point: Lat={Latitude}, Lon={Longitude}, Accuracy={AccuracyMeters}, Name={LocationName}", 
                    message.Latitude.Value, message.Longitude.Value, message.AccuracyMeters, message.LocationName);
                    
                location = new GeoJsonPoint<GeoJson2DGeographicCoordinates>(
                    new GeoJson2DGeographicCoordinates(message.Longitude.Value, message.Latitude.Value));
                    
                _logger.LogInformation("✅ GeoJSON Point created successfully: [{Lon}, {Lat}]", 
                    location.Coordinates.Longitude, location.Coordinates.Latitude);
            }
            else
            {
                _logger.LogWarning("⚠️ No location data: Latitude={Latitude}, Longitude={Longitude}", 
                    message.Latitude, message.Longitude);
            }

            var mediaList = new List<Media>();
            if (message.Media != null)
            {
                foreach (var m in message.Media)
                {
                    if (!string.IsNullOrWhiteSpace(m.Url))
                    {
                        mediaList.Add(new Media 
                        { 
                            Url = m.Url, 
                            Type = m.MediaType ?? "image" 
                        });
                    }
                }
            }

            var newPost = new PostDocument
            {
                Id = message.PostId,
                AuthorId = message.AuthorId,
                AuthorName = message.AuthorName ?? "Blinkr User",
                AuthorGender = message.AuthorGender,
                Title = message.Title ?? string.Empty,
                Content = message.Content ?? string.Empty,
                CreatedAtUtc = message.OccurredOn,
                LikeCount = 0,
                Location = location,
                LocationName = message.LocationName,
                Media = mediaList
            };

            _logger.LogInformation("📝 Post data: Title={Title}, Content={Content}, AuthorId={AuthorId}, Location={Location}", 
                newPost.Title, newPost.Content, newPost.AuthorId, 
                location != null ? $"({location.Coordinates.Latitude}, {location.Coordinates.Longitude})" : "None");

            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, newPost.Id);

            // Use the consume context cancellation token
            var result = await _postsCollection.ReplaceOneAsync(
                filter,
                newPost,
                new ReplaceOptions { IsUpsert = true },
                context.CancellationToken);

            _logger.LogInformation("✅ Successfully projected PostDocument to MongoDB. Database={DbName}, Collection={CollName}, PostId: {PostId}, IsAcknowledged: {Ack}, Matched: {Matched}, Modified: {Modified}, UpsertedId: {UpsertedId}",
                dbName, collName, message.PostId, result.IsAcknowledged, result.MatchedCount, result.ModifiedCount, result.UpsertedId);

            // Invalidate cache after successful DB write
            await CacheInvalidationHelper.InvalidatePostCache(_cache, message.PostId);
        }
        catch (MongoDB.Bson.BsonSerializationException bsx)
        {
            // GUID serileştirme veya benzeri BSON hataları burada yakalanır.
            // Log'la; tercihe göre swallow veya rethrow (retry/error-queue).
            _logger.LogError(bsx, "BsonSerializationException projecting PostDocument. PostId: {PostId} - MsgType: {MsgType}", message.PostId, message.GetType().Name);

            // -> Rethrow to allow MassTransit to apply retry policies and eventually move the message to the error queue.
            // Eğer bu hataları anında swallow etmek istersen, burada 'return;' yap.
            throw;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Consume canceled by token for PostId: {PostId}", message.PostId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error projecting PostDocument to MongoDB. PostId: {PostId}", message.PostId);
            // Re-throw so MassTransit retry/error behavior can handle it
            throw;
        }
    }
}
