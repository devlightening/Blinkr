using MongoDB.Driver;
using MongoDB.Bson;
using BlogService.Infrastructure.ReadModels;
using Microsoft.Extensions.Logging;

namespace BlogService.Infrastructure.Services.Indexes;

/// <summary>
/// Service for managing MongoDB indexes
/// </summary>
public class MongoIndexService
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<MongoIndexService> _logger;

    private readonly IMongoCollection<BsonDocument> _processedMessagesCollection;
    private readonly IMongoCollection<BsonDocument> _mediaUploadsCollection;

    public MongoIndexService(IMongoDatabase database, ILogger<MongoIndexService> logger)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _processedMessagesCollection = database.GetCollection<BsonDocument>("processed_messages");
        _mediaUploadsCollection = database.GetCollection<BsonDocument>("media_uploads");
        _logger = logger;
    }

    /// <summary>
    /// Ensure all required indexes exist with proper idempotency
    /// </summary>
    public async Task EnsureIndexesAsync()
    {
        try
        {
            // List existing indexes first for better idempotency
            var existingIndexes = await ListExistingIndexesAsync();
            
            // Only create compound location+time index (no separate location index)
            await EnsureLocationTimeIndexAsync(existingIndexes); // For NOW feed geospatial queries
            await EnsureAuthorIndexAsync(existingIndexes);
            await EnsureCreatedAtIndexAsync(existingIndexes);
            
            // Ensure ProcessedMessages TTL index
            await EnsureProcessedMessagesTTLIndexAsync();
            await EnsureMediaUploadsIndexesAsync();
            
            _logger.LogInformation("✅ All MongoDB indexes ensured successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to ensure MongoDB indexes");
            throw;
        }
    }

    private async Task EnsureMediaUploadsIndexesAsync()
    {
        var indexes = await _mediaUploadsCollection.Indexes.ListAsync();
        var indexList = await indexes.ToListAsync();
        if (!indexList.Any(idx => idx.GetValue("name", "").AsString == "ix_media_owner_status"))
        {
            await _mediaUploadsCollection.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys.Ascending("OwnerUserId").Ascending("Status").Descending("CreatedAtUtc"),
                new CreateIndexOptions { Name = "ix_media_owner_status", Background = true }));
        }

        if (!indexList.Any(idx => idx.GetValue("name", "").AsString == "ix_media_orphan_cleanup"))
        {
            await _mediaUploadsCollection.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
                Builders<BsonDocument>.IndexKeys.Ascending("PostId").Ascending("CreatedAtUtc").Ascending("Status"),
                new CreateIndexOptions { Name = "ix_media_orphan_cleanup", Background = true }));
        }
    }

    /// <summary>
    /// List existing indexes with their keys for idempotency checks
    /// </summary>
    private async Task<Dictionary<string, BsonDocument>> ListExistingIndexesAsync()
    {
        var indexes = await _postsCollection.Indexes.ListAsync();
        var indexList = await indexes.ToListAsync();
        
        var result = new Dictionary<string, BsonDocument>();
        foreach (var index in indexList)
        {
            var name = index.GetValue("name", "").AsString;
            var key = index.GetValue("key", new BsonDocument()).AsBsonDocument;
            result[name] = key;
        }
        
        _logger.LogInformation("📋 Found {Count} existing indexes: {Names}", 
            result.Count, string.Join(", ", result.Keys));
            
        return result;
    }

    /// <summary>
    /// Create 2dsphere index for geospatial queries
    /// </summary>
    private async Task EnsureLocationIndexAsync(Dictionary<string, BsonDocument> existingIndexes)
    {
        try
        {
            var standardIndexName = "ix_posts_location_2dsphere";
            var expectedKey = new BsonDocument("Location", "2dsphere");
            
            // Check if standard index exists
            if (existingIndexes.ContainsKey(standardIndexName))
            {
                _logger.LogInformation("🗺️ Location 2dsphere index already exists: {Name}", standardIndexName);
                return;
            }
            
            // Check for existing indexes with same key but different name
            var conflictingIndex = existingIndexes.FirstOrDefault(kvp => 
                kvp.Value.Equals(expectedKey) && kvp.Key != standardIndexName);
                
            if (conflictingIndex.Key != null)
            {
                _logger.LogInformation("🔄 Found existing location index with different name: {OldName} → {NewName}", 
                    conflictingIndex.Key, standardIndexName);
                    
                // Drop old index and create new one with standard name
                await _postsCollection.Indexes.DropOneAsync(conflictingIndex.Key);
                _logger.LogInformation("🗑️ Dropped old index: {Name}", conflictingIndex.Key);
            }

            // Create 2dsphere index on Location field
            var indexKeys = Builders<PostDocument>.IndexKeys.Geo2DSphere(x => x.Location);
            var indexOptions = new CreateIndexOptions 
            { 
                Name = standardIndexName,
                Background = true,
                Sparse = true // Only index documents that have Location field
            };

            await _postsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PostDocument>(indexKeys, indexOptions));

            _logger.LogInformation("🗺️ Created 2dsphere index: {Name}", standardIndexName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to create Location 2dsphere index");
            throw;
        }
    }

    /// <summary>
    /// Create compound index for NOW feed: Location + CreatedAtUtc
    /// Optimizes geospatial queries with time filtering
    /// </summary>
    private async Task EnsureLocationTimeIndexAsync(Dictionary<string, BsonDocument> existingIndexes)
    {
        try
        {
            var standardIndexName = "ix_posts_location_time";
            
            // Check if index exists
            if (existingIndexes.ContainsKey(standardIndexName))
            {
                _logger.LogInformation("🗺️⏰ Location+Time compound index already exists: {Name}", standardIndexName);
                return;
            }

            // Create compound index: Location (2dsphere) + CreatedAtUtc (descending)
            // This optimizes NOW feed queries that filter by both location and time
            var indexKeys = Builders<PostDocument>.IndexKeys
                .Geo2DSphere(x => x.Location)
                .Descending(x => x.CreatedAtUtc);
                
            var indexOptions = new CreateIndexOptions 
            { 
                Name = standardIndexName,
                Background = true,
                Sparse = true // Only index documents with Location
            };

            await _postsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PostDocument>(indexKeys, indexOptions));

            _logger.LogInformation("🗺️⏰ Created Location+Time compound index: {Name} (for NOW feed optimization)", standardIndexName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to create Location+Time compound index");
            throw;
        }
    }

    /// <summary>
    /// Create index for author queries
    /// </summary>
    private async Task EnsureAuthorIndexAsync(Dictionary<string, BsonDocument> existingIndexes)
    {
        try
        {
            var standardIndexName = "ix_posts_author_created";
            var expectedKey = new BsonDocument { { "AuthorId", 1 }, { "CreatedAtUtc", -1 } };
            
            // Check if standard compound index exists
            if (existingIndexes.ContainsKey(standardIndexName))
            {
                _logger.LogInformation("👤 Author+Created compound index already exists: {Name}", standardIndexName);
                return;
            }
            
            // Check for conflicting single-field author indexes
            var conflictingIndexes = existingIndexes.Where(kvp => 
                kvp.Value.Contains("AuthorId") && kvp.Key != standardIndexName).ToList();
                
            foreach (var conflicting in conflictingIndexes)
            {
                _logger.LogInformation("🔄 Dropping old author index: {Name}", conflicting.Key);
                await _postsCollection.Indexes.DropOneAsync(conflicting.Key);
            }

            // Create compound index: AuthorId + CreatedAtUtc (for user posts queries)
            var indexKeys = Builders<PostDocument>.IndexKeys
                .Ascending(x => x.AuthorId)
                .Descending(x => x.CreatedAtUtc);
                
            var indexOptions = new CreateIndexOptions 
            { 
                Name = standardIndexName,
                Background = true
            };

            await _postsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PostDocument>(indexKeys, indexOptions));

            _logger.LogInformation("👤 Created compound index: {Name}", standardIndexName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to create AuthorId compound index");
            throw;
        }
    }

    /// <summary>
    /// Create index for date-based queries
    /// </summary>
    private async Task EnsureCreatedAtIndexAsync(Dictionary<string, BsonDocument> existingIndexes)
    {
        try
        {
            var standardIndexName = "ix_posts_created_desc";
            var expectedKey = new BsonDocument("CreatedAtUtc", -1);
            
            // Check if standard index exists
            if (existingIndexes.ContainsKey(standardIndexName))
            {
                _logger.LogInformation("📅 CreatedAtUtc index already exists: {Name}", standardIndexName);
                return;
            }
            
            // Check for existing indexes with same key but different name (case variations)
            var conflictingIndexes = existingIndexes.Where(kvp => 
                kvp.Value.Equals(expectedKey) && kvp.Key != standardIndexName).ToList();
                
            foreach (var conflicting in conflictingIndexes)
            {
                _logger.LogInformation("🔄 Found existing CreatedAt index with different name: {OldName} → {NewName}", 
                    conflicting.Key, standardIndexName);
                    
                // Drop old index and create new one with standard name
                await _postsCollection.Indexes.DropOneAsync(conflicting.Key);
                _logger.LogInformation("🗑️ Dropped old index: {Name}", conflicting.Key);
            }

            var indexKeys = Builders<PostDocument>.IndexKeys.Descending(x => x.CreatedAtUtc);
            var indexOptions = new CreateIndexOptions 
            { 
                Name = standardIndexName,
                Background = true
            };

            await _postsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PostDocument>(indexKeys, indexOptions));

            _logger.LogInformation("📅 Created descending index: {Name}", standardIndexName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to create CreatedAtUtc index");
            throw;
        }
    }

    /// <summary>
    /// Ensure ProcessedMessages collection has TTL index for automatic cleanup
    /// </summary>
    private async Task EnsureProcessedMessagesTTLIndexAsync()
    {
        try
        {
            var indexName = "ix_processed_messages_ttl";
            var ttlSeconds = 2592000; // 30 days
            
            // Check existing indexes on processed_messages collection
            var indexes = await _processedMessagesCollection.Indexes.ListAsync();
            var indexList = await indexes.ToListAsync();
            
            if (indexList.Any(idx => idx.GetValue("name", "").AsString == indexName))
            {
                _logger.LogInformation("🕒 ProcessedMessages TTL index already exists: {Name}", indexName);
                return;
            }

            // Create TTL index on processedAt field
            var indexKeys = Builders<BsonDocument>.IndexKeys.Ascending("processedAt");
            var indexOptions = new CreateIndexOptions 
            { 
                Name = indexName,
                Background = true,
                ExpireAfter = TimeSpan.FromSeconds(ttlSeconds)
            };

            await _processedMessagesCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<BsonDocument>(indexKeys, indexOptions));

            _logger.LogInformation("🕒 Created TTL index for ProcessedMessages: {Name} (expires after {Days} days)", 
                indexName, ttlSeconds / 86400);
                
            // Also ensure unique index on messageId
            var uniqueIndexName = "ix_processed_messages_unique";
            if (!indexList.Any(idx => idx.GetValue("name", "").AsString == uniqueIndexName))
            {
                var uniqueIndexKeys = Builders<BsonDocument>.IndexKeys.Ascending("messageId");
                var uniqueIndexOptions = new CreateIndexOptions 
                { 
                    Name = uniqueIndexName,
                    Background = true,
                    Unique = true
                };

                await _processedMessagesCollection.Indexes.CreateOneAsync(
                    new CreateIndexModel<BsonDocument>(uniqueIndexKeys, uniqueIndexOptions));
                    
                _logger.LogInformation("🔑 Created unique index for ProcessedMessages: {Name}", uniqueIndexName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to create ProcessedMessages TTL index");
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
