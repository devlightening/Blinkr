using MongoDB.Driver;
using Blinkr.Projections.Worker.Documents;

namespace Blinkr.Projections.Worker;

public class MongoIndexManager
{
    private readonly IMongoDatabase _database;

    public MongoIndexManager(IMongoDatabase database)
    {
        _database = database;
    }

    public async Task CreateIndexesAsync()  
    {
        var postsCollection = _database.GetCollection<PostDocument>("posts");
        
        // Feed index: CreatedAtUtc descending (for sorting by newest first)
        var feedIndexKeys = Builders<PostDocument>.IndexKeys.Descending(p => p.CreatedAtUtc);
        var feedIndexModel = new CreateIndexModel<PostDocument>(feedIndexKeys);
        
        // User posts index: AuthorId + CreatedAtUtc descending
        var userPostsIndexKeys = Builders<PostDocument>.IndexKeys
            .Ascending(p => p.AuthorId)
            .Descending(p => p.CreatedAtUtc);
        var userPostsIndexModel = new CreateIndexModel<PostDocument>(userPostsIndexKeys);

        var visibilityIndexKeys = Builders<PostDocument>.IndexKeys
            .Ascending(p => p.AudienceType)
            .Ascending(p => p.ExpiresAt)
            .Descending(p => p.CreatedAtUtc);
        var visibilityIndexModel = new CreateIndexModel<PostDocument>(
            visibilityIndexKeys,
            new CreateIndexOptions { Name = "ix_posts_public_freshness" });
        var processedCollection = _database.GetCollection<MongoDB.Bson.BsonDocument>("processed_messages");
        var processedMessageIndexes = new[]
        {
            new CreateIndexModel<MongoDB.Bson.BsonDocument>(
                Builders<MongoDB.Bson.BsonDocument>.IndexKeys.Ascending("processedAt"),
                new CreateIndexOptions
                {
                    Name = "ix_processed_messages_ttl",
                    ExpireAfter = TimeSpan.FromDays(30),
                    Background = true
                }),
            new CreateIndexModel<MongoDB.Bson.BsonDocument>(
                Builders<MongoDB.Bson.BsonDocument>.IndexKeys.Ascending("eventId").Ascending("consumer"),
                new CreateIndexOptions
                {
                    Name = "ix_processed_messages_event_consumer",
                    Unique = true,
                    Background = true
                })
        };
        
        // Note: Geospatial indexing is handled by BlogService MongoIndexService
        // which creates compound index "ix_posts_location_time" for optimal NOW feed performance
        
        await postsCollection.Indexes.CreateManyAsync(
            new[] { feedIndexModel, userPostsIndexModel, visibilityIndexModel });
        await processedCollection.Indexes.CreateManyAsync(processedMessageIndexes);
    }
}
