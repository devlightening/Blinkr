using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.ReadModels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;

namespace BlogService.Infrastructure.Services;

/// <summary>
/// Service for syncing posts from Postgres write model to MongoDB read model
/// </summary>
public interface IPostReadModelSyncService
{
    Task<int> SyncMissingPostsToMongoAsync(CancellationToken cancellationToken = default);
}

public class PostReadModelSyncService : IPostReadModelSyncService
{
    private readonly BlogDbContext _blogDbContext;
    private readonly IMongoDatabase _mongoDb;
    private readonly ILogger<PostReadModelSyncService> _logger;

    public PostReadModelSyncService(
        BlogDbContext blogDbContext,
        IMongoDatabase mongoDb,
        ILogger<PostReadModelSyncService> logger)
    {
        _blogDbContext = blogDbContext;
        _mongoDb = mongoDb;
        _logger = logger;
    }

    /// <summary>
    /// Sync posts from Postgres that are missing in MongoDB
    /// </summary>
    public async Task<int> SyncMissingPostsToMongoAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("WS-11A: Starting sync of missing posts from Postgres to MongoDB");

        try
        {
            var postsCollection = _mongoDb.GetCollection<PostDocument>("posts");

            // Get all post IDs from Postgres
            var postgresPostIds = await _blogDbContext.Posts
                .AsNoTracking()
                .Select(p => p.Id)
                .ToListAsync(cancellationToken);

            _logger.LogInformation("WS-11A: Found {Count} posts in Postgres", postgresPostIds.Count);

            // Get all post IDs from MongoDB
            var mongoPostIds = await postsCollection
                .Find(_ => true)
                .Project(p => p.Id)
                .ToListAsync(cancellationToken);

            _logger.LogInformation("WS-11A: Found {Count} posts in MongoDB", mongoPostIds.Count);

            // Find missing posts
            var missingIds = postgresPostIds.Except(mongoPostIds).ToList();
            _logger.LogInformation("WS-11A: Found {Count} missing posts to sync", missingIds.Count);

            if (missingIds.Count == 0)
            {
                _logger.LogInformation("WS-11A: No missing posts to sync");
                return 0;
            }

            int syncedCount = 0;

            // Sync each missing post
            foreach (var postId in missingIds)
            {
                try
                {
                    var postgresPost = await _blogDbContext.Posts
                        .AsNoTracking()
                        .FirstOrDefaultAsync(p => p.Id == postId, cancellationToken);

                    if (postgresPost == null)
                    {
                        _logger.LogWarning("WS-11A: Post {PostId} not found in Postgres", postId);
                        continue;
                    }

                    // Create MongoDB document
                    var mongoDoc = new PostDocument
                    {
                        Id = postgresPost.Id,
                        AuthorId = postgresPost.AuthorId,
                        AuthorName = "Unknown",
                        AuthorGender = null,
                        Title = postgresPost.Title ?? string.Empty,
                        Content = postgresPost.Content ?? string.Empty,
                        CreatedAtUtc = postgresPost.CreatedAt,
                        UpdatedAtUtc = null,
                        LikeCount = 0,
                        LocationName = postgresPost.LocationName,
                        Location = CreateLocationEntity(postgresPost.Latitude, postgresPost.Longitude)
                    };

                    // Upsert to MongoDB
                    var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, mongoDoc.Id);
                    var result = await postsCollection.ReplaceOneAsync(
                        filter,
                        mongoDoc,
                        new ReplaceOptions { IsUpsert = true },
                        cancellationToken);

                    if (result.IsAcknowledged)
                    {
                        syncedCount++;
                        _logger.LogDebug("WS-11A: Synced post {PostId} to MongoDB", postId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "WS-11A: Error syncing post {PostId}", postId);
                }
            }

            _logger.LogInformation("WS-11A: Sync completed. Synced {Count} posts", syncedCount);
            return syncedCount;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WS-11A: Error during sync operation");
            throw;
        }
    }

    private LocationEntity? CreateLocationEntity(double? latitude, double? longitude)
    {
        if (!latitude.HasValue || !longitude.HasValue)
        {
            return null;
        }

        return new LocationEntity
        {
            Type = "Point",
            Coordinates = new[] { longitude.Value, latitude.Value },
            CreatedAtUtc = DateTime.UtcNow
        };
    }
}
