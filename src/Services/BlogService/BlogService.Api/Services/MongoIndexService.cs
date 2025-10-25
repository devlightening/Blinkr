using MongoDB.Driver;
using BlogService.Api.ReadModels;

namespace BlogService.Api.Services;

/// <summary>
/// Service for managing MongoDB indexes
/// </summary>
public class MongoIndexService
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<MongoIndexService> _logger;

    public MongoIndexService(IMongoDatabase database, ILogger<MongoIndexService> logger)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    /// <summary>
    /// Ensure all required indexes exist
    /// </summary>
    public async Task EnsureIndexesAsync()
    {
        try
        {
            await EnsureLocationIndexAsync();
            await EnsureAuthorIndexAsync();
            await EnsureCreatedAtIndexAsync();
            
            _logger.LogInformation("✅ All MongoDB indexes ensured successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to ensure MongoDB indexes");
            throw;
        }
    }

    /// <summary>
    /// Create 2dsphere index for geospatial queries
    /// </summary>
    private async Task EnsureLocationIndexAsync()
    {
        try
        {
            var indexName = "location_2dsphere";
            
            // Check if index already exists
            var existingIndexes = await _postsCollection.Indexes.ListAsync();
            var indexList = await existingIndexes.ToListAsync();
            
            if (indexList.Any(idx => idx.GetValue("name", "").AsString == indexName))
            {
                _logger.LogInformation("🗺️ Location 2dsphere index already exists");
                return;
            }

            // Create 2dsphere index on Location field
            var indexKeys = Builders<PostDocument>.IndexKeys.Geo2DSphere(x => x.Location);
            var indexOptions = new CreateIndexOptions 
            { 
                Name = indexName,
                Background = true,
                Sparse = true // Only index documents that have Location field
            };

            await _postsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PostDocument>(indexKeys, indexOptions));

            _logger.LogInformation("🗺️ Created 2dsphere index for Location field");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to create Location 2dsphere index");
            throw;
        }
    }

    /// <summary>
    /// Create index for author queries
    /// </summary>
    private async Task EnsureAuthorIndexAsync()
    {
        try
        {
            var indexName = "authorId_1";
            
            var existingIndexes = await _postsCollection.Indexes.ListAsync();
            var indexList = await existingIndexes.ToListAsync();
            
            if (indexList.Any(idx => idx.GetValue("name", "").AsString == indexName))
            {
                _logger.LogInformation("👤 AuthorId index already exists");
                return;
            }

            var indexKeys = Builders<PostDocument>.IndexKeys.Ascending(x => x.AuthorId);
            var indexOptions = new CreateIndexOptions 
            { 
                Name = indexName,
                Background = true
            };

            await _postsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PostDocument>(indexKeys, indexOptions));

            _logger.LogInformation("👤 Created index for AuthorId field");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to create AuthorId index");
            throw;
        }
    }

    /// <summary>
    /// Create index for date-based queries
    /// </summary>
    private async Task EnsureCreatedAtIndexAsync()
    {
        try
        {
            var indexName = "createdAtUtc_-1";
            
            var existingIndexes = await _postsCollection.Indexes.ListAsync();
            var indexList = await existingIndexes.ToListAsync();
            
            if (indexList.Any(idx => idx.GetValue("name", "").AsString == indexName))
            {
                _logger.LogInformation("📅 CreatedAtUtc index already exists");
                return;
            }

            var indexKeys = Builders<PostDocument>.IndexKeys.Descending(x => x.CreatedAtUtc);
            var indexOptions = new CreateIndexOptions 
            { 
                Name = indexName,
                Background = true
            };

            await _postsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PostDocument>(indexKeys, indexOptions));

            _logger.LogInformation("📅 Created descending index for CreatedAtUtc field");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to create CreatedAtUtc index");
            throw;
        }
    }

    /// <summary>
    /// List all indexes for debugging
    /// </summary>
    public async Task<List<string>> ListIndexesAsync()
    {
        try
        {
            var indexes = await _postsCollection.Indexes.ListAsync();
            var indexList = await indexes.ToListAsync();
            
            var indexNames = indexList.Select(idx => idx.GetValue("name", "").AsString).ToList();
            
            _logger.LogInformation("📋 Existing indexes: {Indexes}", string.Join(", ", indexNames));
            
            return indexNames;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to list indexes");
            throw;
        }
    }
}
