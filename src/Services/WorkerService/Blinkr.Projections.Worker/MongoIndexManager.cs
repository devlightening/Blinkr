using MongoDB.Driver;
using Blinkr.Projections.Worker.Documents;

namespace Blinkr.Projections.Worker;

public class MongoIndexManager
{
    // Mongo error codes raised when an index with the same key (86) or same name (85)
    // already exists with different options/name, e.g. one created by BlogService.
    private const int IndexOptionsConflict = 85;
    private const int IndexKeySpecsConflict = 86;

    private readonly IMongoDatabase _database;
    private readonly ILogger<MongoIndexManager> _logger;

    public MongoIndexManager(IMongoDatabase database, ILogger<MongoIndexManager> logger)
    {
        _database = database;
        _logger = logger;
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

        // Each index is ensured on its own so one conflicting index cannot stop the rest.
        await EnsureIndexAsync(postsCollection, feedIndexModel);
        // V2-4: the hashtag feed (newest first within a tag).
        await EnsureIndexAsync(postsCollection, new CreateIndexModel<PostDocument>(
            Builders<PostDocument>.IndexKeys.Ascending(p => p.Hashtags).Descending(p => p.CreatedAtUtc),
            new CreateIndexOptions { Name = "ix_posts_hashtags_time" }));
        await EnsureIndexAsync(postsCollection, userPostsIndexModel);
        await EnsureIndexAsync(postsCollection, visibilityIndexModel);
        foreach (var model in processedMessageIndexes)
        {
            await EnsureIndexAsync(processedCollection, model);
        }
    }

    private async Task EnsureIndexAsync<T>(IMongoCollection<T> collection, CreateIndexModel<T> model)
    {
        try
        {
            await collection.Indexes.CreateOneAsync(model);
        }
        catch (MongoCommandException ex) when (ex.Code is IndexOptionsConflict or IndexKeySpecsConflict)
        {
            // An equivalent index already exists under another name/options. That is enough for
            // reads, so it is not a startup failure. Real Mongo errors still propagate.
            _logger.LogInformation(
                "Mongo index already present in another form; skipping. Collection={Collection} Index={Index} Code={Code}",
                collection.CollectionNamespace.CollectionName,
                model.Options?.Name ?? "(default name)",
                ex.Code);
        }
    }
}
