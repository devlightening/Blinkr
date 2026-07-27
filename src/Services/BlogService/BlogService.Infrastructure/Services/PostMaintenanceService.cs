using BlogService.Infrastructure.ReadModels;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Npgsql;

namespace BlogService.Infrastructure.Services;

/// <summary>
/// Maintenance service for post read model synchronization
/// </summary>
public interface IPostMaintenanceService
{
    Task<int> SyncAuthorNamesAsync(CancellationToken cancellationToken = default);
    Task<int> MarkPostsWithoutLocationAsDeletedAsync(CancellationToken cancellationToken = default);
}

public class PostMaintenanceService : IPostMaintenanceService
{
    private readonly IMongoDatabase _mongoDb;
    private readonly string _identityConnectionString;
    private readonly ILogger<PostMaintenanceService> _logger;

    public PostMaintenanceService(
        IMongoDatabase mongoDb,
        IConfiguration configuration,
        ILogger<PostMaintenanceService> logger)
    {
        _mongoDb = mongoDb;
        _identityConnectionString = configuration.GetConnectionString("IdentityDb") 
            ?? throw new InvalidOperationException("IdentityDb connection string not configured");
        _logger = logger;
    }

    /// <summary>
    /// Sync AuthorName in MongoDB posts collection with actual UserName from Identity Users table
    /// </summary>
    public async Task<int> SyncAuthorNamesAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("WS-10B: Starting AuthorName sync from Identity.Users to MongoDB posts");

        var postsCollection = _mongoDb.GetCollection<PostDocument>("posts");

        // Find all posts with missing or "Blinkr User" AuthorName
        var filter = Builders<PostDocument>.Filter.Or(
            Builders<PostDocument>.Filter.Eq(x => x.AuthorName, "Blinkr User"),
            Builders<PostDocument>.Filter.Eq(x => x.AuthorName, null),
            Builders<PostDocument>.Filter.Eq(x => x.AuthorName, "")
        );

        var postsToUpdate = await postsCollection
            .Find(filter)
            .ToListAsync(cancellationToken);

        _logger.LogInformation("WS-10B: Found {Count} posts to update", postsToUpdate.Count);

        int updatedCount = 0;

        foreach (var post in postsToUpdate)
        {
            try
            {
                // Get real username from Identity Users table via PostgreSQL
                var userName = await GetUserNameAsync(post.AuthorId, cancellationToken);

                if (string.IsNullOrEmpty(userName))
                {
                    _logger.LogWarning("WS-10B: User not found for AuthorId={AuthorId} in post {PostId}", 
                        post.AuthorId, post.Id);
                    continue;
                }

                // Update MongoDB document with real username
                var update = Builders<PostDocument>.Update
                    .Set(x => x.AuthorName, userName);

                var result = await postsCollection.UpdateOneAsync(
                    Builders<PostDocument>.Filter.Eq(x => x.Id, post.Id),
                    update,
                    cancellationToken: cancellationToken);

                if (result.ModifiedCount > 0)
                {
                    updatedCount++;
                    _logger.LogDebug("WS-10B: Updated post {PostId} with AuthorName={UserName}", 
                        post.Id, userName);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WS-10B: Error updating post {PostId}", post.Id);
            }
        }

        _logger.LogInformation("WS-10B: AuthorName sync completed. Updated {Count} posts", updatedCount);
        return updatedCount;
    }

    /// <summary>
    /// Mark posts without location data as deleted
    /// This cleans up old test posts that don't have Latitude/Longitude
    /// </summary>
    public async Task<int> MarkPostsWithoutLocationAsDeletedAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Starting cleanup: marking posts without location as deleted");

        var postsCollection = _mongoDb.GetCollection<PostDocument>("posts");

        // Find all posts with null Latitude or Longitude
        var filter = Builders<PostDocument>.Filter.Or(
            Builders<PostDocument>.Filter.Eq(x => x.Location, null),
            Builders<PostDocument>.Filter.Eq(x => x.LocationName, null),
            Builders<PostDocument>.Filter.Eq(x => x.LocationName, "")
        );

        var postsToDelete = await postsCollection
            .Find(filter)
            .ToListAsync(cancellationToken);

        _logger.LogInformation("Found {Count} posts without location data", postsToDelete.Count);

        int deletedCount = 0;

        foreach (var post in postsToDelete)
        {
            try
            {
                // Delete the post document from MongoDB
                var deleteResult = await postsCollection.DeleteOneAsync(
                    Builders<PostDocument>.Filter.Eq(x => x.Id, post.Id),
                    cancellationToken);

                if (deleteResult.DeletedCount > 0)
                {
                    deletedCount++;
                    _logger.LogDebug("Deleted post {PostId} - no location data", post.Id);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting post {PostId}", post.Id);
            }
        }

        _logger.LogInformation("Cleanup completed. Deleted {Count} posts without location", deletedCount);
        return deletedCount;
    }

    private async Task<string?> GetUserNameAsync(Guid userId, CancellationToken cancellationToken)
    {
        try
        {
            using var connection = new NpgsqlConnection(_identityConnectionString);
            await connection.OpenAsync(cancellationToken);

            using var command = connection.CreateCommand();
            command.CommandText = @"
                SELECT ""UserName""
                FROM public.""AspNetUsers""
                WHERE ""Id"" = @UserId
                LIMIT 1";
            
            command.Parameters.AddWithValue("@UserId", userId);

            using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                return reader.GetString(0);
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WS-10B: Error querying user {UserId} from Identity database", userId);
            return null;
        }
    }
}
