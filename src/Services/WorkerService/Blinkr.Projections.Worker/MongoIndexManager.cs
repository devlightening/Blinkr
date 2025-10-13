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
        
        await postsCollection.Indexes.CreateManyAsync(
            new[] { feedIndexModel, userPostsIndexModel });
    }
}
