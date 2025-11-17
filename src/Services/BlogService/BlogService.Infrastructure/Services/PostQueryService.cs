using BlogService.Infrastructure.ReadModels;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Services.Queries;
using BlogService.Infrastructure.Geocoding;
using MongoDB.Driver;
using MongoDB.Bson;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Collections;
using System.Linq;

namespace BlogService.Infrastructure.Services;

public class PostQueryService : IPostQueryService
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostQueryService> _logger;
    private readonly NowFeedOptions _nowFeedOptions;

    public PostQueryService(
        IMongoDatabase database,
        ILogger<PostQueryService> logger,
        IOptions<NowFeedOptions> nowFeedOptions)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _nowFeedOptions = nowFeedOptions.Value;
    }

    public async Task<PostReadDto?> GetPostByIdAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("🔍 Getting post by ID: {PostId}", postId);

        var post = await _postsCollection
            .Find(p => p.Id == postId)
            .FirstOrDefaultAsync(cancellationToken);

        if (post == null)
        {
            _logger.LogWarning("⚠️ Post not found: {PostId}", postId);
            return null;
        }

        return MapToPostReadDto(post);
    }

    public async Task<PaginatedResult<PostReadDto>> GetFeedAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("📰 Getting feed: page={Page}, pageSize={PageSize}", page, pageSize);

        var skip = (page - 1) * pageSize;

        var posts = await _postsCollection
            .Find(FilterDefinition<PostDocument>.Empty)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        var totalCount = await _postsCollection.CountDocumentsAsync(FilterDefinition<PostDocument>.Empty, cancellationToken: cancellationToken);

        var items = posts.Select(MapToPostReadDto).ToList();

        return new PaginatedResult<PostReadDto>
        {
            Items = items,
            TotalCount = (int)totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PaginatedResult<PostReadDto>> GetUserPostsAsync(Guid authorId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("👤 Getting user posts: authorId={AuthorId}, page={Page}, pageSize={PageSize}", authorId, page, pageSize);

        var skip = (page - 1) * pageSize;
        var filter = Builders<PostDocument>.Filter.Eq(p => p.AuthorId, authorId);

        var posts = await _postsCollection
            .Find(filter)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        var totalCount = await _postsCollection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);

        var items = posts.Select(MapToPostReadDto).ToList();

        return new PaginatedResult<PostReadDto>
        {
            Items = items,
            TotalCount = (int)totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<bool> PostExistsAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        var count = await _postsCollection.CountDocumentsAsync(
            p => p.Id == postId,
            cancellationToken: cancellationToken);

        return count > 0;
    }

    public async Task<PagedResult<PostListDto>> QueryPostsAsync(PostQuery query, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("🔍 Querying posts with filters");

        var filterBuilder = Builders<PostDocument>.Filter;
        var filter = filterBuilder.Empty;

        // Author filter
        if (!string.IsNullOrWhiteSpace(query.AuthorId))
        {
            if (Guid.TryParse(query.AuthorId, out var authorGuid))
            {
                filter &= filterBuilder.Eq(p => p.AuthorId, authorGuid);
            }
        }

        // Search filter (title and content)
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var searchFilter = filterBuilder.Or(
                filterBuilder.Regex(p => p.Title, new BsonRegularExpression(query.Search, "i")),
                filterBuilder.Regex(p => p.Content, new BsonRegularExpression(query.Search, "i"))
            );
            filter &= searchFilter;
        }

        // Sorting - parse Sort string (e.g., "createdAt:desc", "likeCount:desc")
        var sortParts = query.Sort.Split(':');
        var sortField = sortParts.Length > 0 ? sortParts[0].ToLower() : "createdat";
        var sortDirection = sortParts.Length > 1 ? sortParts[1].ToLower() : "desc";
        var isDescending = sortDirection == "desc";

        SortDefinition<PostDocument> sort = sortField switch
        {
            "title" => isDescending
                ? Builders<PostDocument>.Sort.Descending(p => p.Title)
                : Builders<PostDocument>.Sort.Ascending(p => p.Title),
            "author" => isDescending
                ? Builders<PostDocument>.Sort.Descending(p => p.AuthorId)
                : Builders<PostDocument>.Sort.Ascending(p => p.AuthorId),
            "likecount" => isDescending
                ? Builders<PostDocument>.Sort.Descending(p => p.LikeCount)
                : Builders<PostDocument>.Sort.Ascending(p => p.LikeCount),
            _ => isDescending
                ? Builders<PostDocument>.Sort.Descending(p => p.CreatedAtUtc)
                : Builders<PostDocument>.Sort.Ascending(p => p.CreatedAtUtc)
        };

        // Execute query with pagination
        var skip = query.Skip;

        var posts = await _postsCollection
            .Find(filter)
            .Sort(sort)
            .Skip(skip)
            .Limit(query.PageSize)
            .ToListAsync(cancellationToken);

        // Get total count for pagination
        var totalCount = await _postsCollection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);

        // Map to DTOs
        var items = posts.Select(MapToPostListDto).ToList();

        return new PagedResult<PostListDto>(
            items,
            total: (int)totalCount,
            page: query.Page,
            pageSize: query.PageSize
        );
    }

    public async Task<PostReadDto?> GetByIdAsync(Guid postId, CancellationToken cancellationToken = default)
    {
        return await GetPostByIdAsync(postId, cancellationToken);
    }

    public async Task<PagedResult<PostListDto>> GetNearbyAsync(NearbyQuery query, CancellationToken cancellationToken = default)
    {
        var q = query.Clamp();

        _logger.LogInformation("📍 NOW Nearby query: lat={Lat}, lon={Lon}, radius={Radius}m, sinceMin={SinceMin}, page={Page}",
            q.Lat, q.Lon, q.RadiusMeters, q.SinceMinutes, q.Page);
        
        _logger.LogInformation("🚀 WS-06B: Using NEW $facet pipeline implementation");

        try
        {
            // Check if any posts have Location field first
            var hasLocationCount = await _postsCollection.CountDocumentsAsync(
                Builders<PostDocument>.Filter.Exists("Location"),
                cancellationToken: cancellationToken);

            _logger.LogInformation("📊 Posts with Location field: {Count}", hasLocationCount);

            // DEBUG: Show actual location coordinates
            if (hasLocationCount > 0)
            {
                _logger.LogInformation("🔍 Searching for sample post with Location...");

                var samplePost = await _postsCollection.Find(Builders<PostDocument>.Filter.Exists("Location"))
                    .Limit(1)
                    .FirstOrDefaultAsync(cancellationToken);

                _logger.LogInformation("🔍 Sample post found: {Found}", samplePost != null);

                if (samplePost?.Location != null)
                {
                    _logger.LogInformation("🗺️ Sample post location type: {Type}", samplePost.Location.Type);
                    _logger.LogInformation("🔍 Location object: {Location}", samplePost.Location.ToString());

                    try
                    {
                        var coords = samplePost.Location.Coordinates;
                        _logger.LogInformation("🔍 Coordinates object: {Coords}", coords?.ToString() ?? "null");

                        if (coords != null && coords.Any() && coords.Count() >= 2)
                        {
                            var coordArray = coords.ToArray();
                            _logger.LogInformation("📍 Coordinates: [lon={Lon}, lat={Lat}]",
                                coordArray[0], coordArray[1]);
                        }
                        else
                        {
                            _logger.LogWarning("⚠️ Coordinates null or insufficient count");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ Could not read coordinates: {Error}", ex.Message);
                    }
                }
                else
                {
                    _logger.LogWarning("⚠️ Sample post or Location is null - ADDING TEST LOCATION");

                    // Add test location directly to MongoDB
                    try
                    {
                        var testLocation = new MongoDB.Driver.GeoJsonObjectModel.GeoJsonPoint<MongoDB.Driver.GeoJsonObjectModel.GeoJson2DGeographicCoordinates>(
                            new MongoDB.Driver.GeoJsonObjectModel.GeoJson2DGeographicCoordinates(28.9784, 41.0082));

                        var filter = Builders<PostDocument>.Filter.Empty;
                        var update = Builders<PostDocument>.Update.Set("Location", testLocation);

                        var result = await _postsCollection.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);

                        _logger.LogInformation("🔧 Added test location to {Count} documents", result.ModifiedCount);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "❌ Failed to add test location");
                    }
                }
            }

            if (hasLocationCount == 0)
            {
                _logger.LogWarning("⚠️ No posts with Location field found. Returning empty result.");
                return new PagedResult<PostListDto>(
                    new List<PostListDto>(),
                    total: 0,
                    page: q.Page,
                    pageSize: q.PageSize
                );
            }

            // Build geospatial aggregation pipeline with NOW/LIVE filtering
            var geoNearQuery = new BsonDocument();

            // Time filter: only posts within last N minutes
            if (q.SinceMinutes > 0)
            {
                var cutoffTime = DateTime.UtcNow.AddMinutes(-q.SinceMinutes);
                geoNearQuery["CreatedAtUtc"] = new BsonDocument("$gte", cutoffTime);
                _logger.LogInformation("⏰ Time filter: posts since {CutoffTime} ({SinceMin} minutes ago)",
                    cutoffTime, q.SinceMinutes);
            }

            // Category filter
            if (!string.IsNullOrWhiteSpace(q.Category))
            {
                geoNearQuery["Category"] = q.Category;
            }

            // Use $facet to get both items and total count in single query
            var basePipeline = new List<BsonDocument>
            {
                new("$geoNear", new BsonDocument
                {
                    ["near"] = new BsonDocument
                    {
                        ["type"] = "Point",
                        ["coordinates"] = new BsonArray { q.Lon, q.Lat }
                    },
                    ["distanceField"] = "distanceMeters",
                    ["maxDistance"] = q.RadiusMeters,
                    ["spherical"] = true,
                    ["query"] = geoNearQuery
                }),
                // Add freshness calculation
                new("$addFields", new BsonDocument
                {
                    ["freshnessSec"] = new BsonDocument("$divide", new BsonArray
                    {
                        new BsonDocument("$subtract", new BsonArray { "$$NOW", "$CreatedAtUtc" }),
                        1000 // Convert ms to seconds
                    }),
                    ["isLive"] = new BsonDocument("$lte", new BsonArray
                    {
                        new BsonDocument("$divide", new BsonArray
                        {
                            new BsonDocument("$subtract", new BsonArray { "$$NOW", "$CreatedAtUtc" }),
                            1000
                        }),
                        3600 // 1 hour = 3600 seconds
                    })
                }),
                // Enhanced decay score calculation
                new("$addFields", new BsonDocument
                {
                    // Normalize distance to kilometers
                    ["distanceKm"] = new BsonDocument("$divide", new BsonArray { "$distanceMeters", 1000.0 }),
                    // Freshness in hours
                    ["freshHours"] = new BsonDocument("$divide", new BsonArray { "$freshnessSec", 3600.0 }),
                    // Base score: closer is better (1 / (1 + distance_km))
                    ["baseScore"] = new BsonDocument("$divide", new BsonArray
                    {
                        1.0,
                        new BsonDocument("$add", new BsonArray
                        {
                            1.0,
                            new BsonDocument("$divide", new BsonArray { "$distanceMeters", 1000.0 })
                        })
                    }),
                    // Time factor: exp(-freshHours / 6.0) - 6h half-life
                    ["timeFactor"] = new BsonDocument("$exp", new BsonDocument("$divide", new BsonArray
                    {
                        new BsonDocument("$multiply", new BsonArray
                        {
                            new BsonDocument("$divide", new BsonArray { "$freshnessSec", 3600.0 }),
                            -1.0
                        }),
                        6.0
                    })),
                    // Popularity factor: 1 + likeCount * 0.05
                    ["popularityFactor"] = new BsonDocument("$add", new BsonArray
                    {
                        1.0,
                        new BsonDocument("$multiply", new BsonArray { "$LikeCount", 0.05 })
                    })
                }),
                // Final decay score calculation
                new("$addFields", new BsonDocument
                {
                    ["decayScore"] = new BsonDocument("$multiply", new BsonArray
                    {
                        "$baseScore",
                        "$timeFactor",
                        "$popularityFactor"
                    })
                })
            };

            // Add $facet stage for pagination and total count
            var pipeline = new List<BsonDocument>(basePipeline)
            {
                new("$facet", new BsonDocument
                {
                    // 1) Paged items
                    ["items"] = new BsonArray
                    {
                        new BsonDocument("$sort", new BsonDocument
                        {
                            { "decayScore", -1 },        // primary: score desc
                            { "distanceMeters", 1 },     // secondary: distance asc
                            { "_id", -1 }                // tiebreaker
                        }),
                        new BsonDocument("$skip", (q.Page - 1) * q.PageSize),
                        new BsonDocument("$limit", q.PageSize)
                    },
                    // 2) Total count (for pagination)
                    ["totalCount"] = new BsonArray
                    {
                        new BsonDocument("$count", "count")
                    }
                })
            };

            _logger.LogInformation("🚀 WS-06C: Executing $facet pipeline with {StageCount} stages", pipeline.Count);

            var cursor = await _postsCollection.AggregateAsync<BsonDocument>(pipeline, cancellationToken: cancellationToken);
            var facetResult = await cursor.FirstOrDefaultAsync(cancellationToken);

            if (facetResult == null)
            {
                _logger.LogWarning("⚠️ WS-06C: Nearby facet result is null.");
                return new PagedResult<PostListDto>(
                    new List<PostListDto>(),
                    total: 0,
                    page: q.Page,
                    pageSize: q.PageSize
                );
            }

            // Extract items
            var itemsArray = facetResult.GetValue("items", new BsonArray()).AsBsonArray;

            // Extract total count
            var totalCountArray = facetResult.GetValue("totalCount", new BsonArray()).AsBsonArray;
            var totalCount = 0;
            if (totalCountArray.Any())
            {
                var countDoc = totalCountArray[0].AsBsonDocument;
                if (countDoc.TryGetValue("count", out var countValue) &&
                    !countValue.IsBsonNull && countValue.IsNumeric)
                {
                    totalCount = countValue.ToInt32();
                }
            }

            // Calculate pagination metadata
            var totalPages = totalCount > 0
                ? (int)Math.Ceiling((double)totalCount / q.PageSize)
                : 0;

            var hasNext = totalPages > 0 && q.Page < totalPages;
            var hasPrevious = q.Page > 1;

            _logger.LogInformation(
                "� WS-06C: Pagination: Total={Total}, Page={Page}, PageSize={PageSize}, TotalPages={TotalPages}, HasNext={HasNext}, HasPrevious={HasPrevious}",
                totalCount, q.Page, q.PageSize, totalPages, hasNext, hasPrevious);

            // Map items from BsonDocument to PostListDto
            var items = itemsArray.Select(doc =>
            {
                var bsonDoc = doc.AsBsonDocument;
                var post = MongoDB.Bson.Serialization.BsonSerializer.Deserialize<PostDocument>(bsonDoc);

                // Get distance from $geoNear with enhanced null safety
                double? distance = null;
                if (bsonDoc.TryGetValue("distanceMeters", out var distanceValue) && 
                    !distanceValue.IsBsonNull && distanceValue.IsNumeric)
                {
                    distance = distanceValue.ToDouble();
                }

                // Get freshness metrics with enhanced null safety
                int? freshnessSec = null;
                if (bsonDoc.TryGetValue("freshnessSec", out var freshnessValue) && 
                    !freshnessValue.IsBsonNull && freshnessValue.IsNumeric)
                {
                    freshnessSec = (int)freshnessValue.ToDouble();
                }

                bool isLive = false;
                if (bsonDoc.TryGetValue("isLive", out var isLiveValue) && 
                    !isLiveValue.IsBsonNull && isLiveValue.IsBoolean)
                {
                    isLive = isLiveValue.ToBoolean();
                }

                // Get decayScore with enhanced null safety
                double? decayScore = null;
                if (bsonDoc.TryGetValue("decayScore", out var decayValue) &&
                    !decayValue.IsBsonNull && decayValue.IsNumeric)
                {
                    decayScore = decayValue.ToDouble();
                }

                return MapToPostListDtoWithNowMetrics(post, distance, freshnessSec, isLive, decayScore);
            }).ToList();

            _logger.LogInformation("� WS-06C: Nearby query completed. Found={Count}/{Total} items",
                items.Count, totalCount);

            // Log top 3 posts for debugging
            if (items.Count > 0)
            {
                var topPosts = items.Take(3).ToList();
                _logger.LogInformation("🏆 Top {Count} posts by decayScore:", topPosts.Count);
                for (int i = 0; i < topPosts.Count; i++)
                {
                    var post = topPosts[i];
                    _logger.LogInformation("  #{Rank}: Title='{Title}', Distance={Distance}m, Freshness={Freshness}s, Likes={Likes}, DecayScore={DecayScore}",
                        i + 1, post.Title, post.DistanceMeters?.ToString("F1") ?? "null", 
                        post.FreshnessSec?.ToString() ?? "null", post.LikeCount, post.DecayScore?.ToString("F4") ?? "null");
                }

                // Debug media URLs for first post
                var firstPost = items.First();
                if (firstPost.MediaUrls.Any())
                {
                    _logger.LogInformation("🖼️ First post media URLs: {MediaUrls}", string.Join(", ", firstPost.MediaUrls));
                }
                else
                {
                    _logger.LogInformation("🖼️ First post has no media URLs");
                }
            }

            return new PagedResult<PostListDto>(
                items,
                total: totalCount,
                page: q.Page,
                pageSize: q.PageSize
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error in nearby query: lat={Lat}, lon={Lon}, radius={Radius}m",
                q.Lat, q.Lon, q.RadiusMeters);
            throw;
        }
    }

    private static PostReadDto MapToPostReadDto(PostDocument post)
    {
        return new PostReadDto
        {
            Id = post.Id,
            AuthorId = post.AuthorId,
            Title = post.Title,
            Content = post.Content,
            CreatedAtUtc = post.CreatedAtUtc,
            LikeCount = post.LikeCount,
            Comments = post.Comments?.Select(c => new CommentDto
            {
                CommentId = c.Id,
                UserId = c.AuthorId,
                Text = c.Text,
                CreatedAtUtc = c.CreatedAtUtc
            }).ToList() ?? new List<CommentDto>(),
            Media = post.Media?.Select(m => new MediaDto
            {
                Url = m.Url,
                MediaType = m.Type
            }).ToList() ?? new List<MediaDto>()
        };
    }

    private static PostListDto MapToPostListDto(PostDocument post)
    {
        return new PostListDto
        {
            Id = post.Id,
            Title = post.Title,
            Content = post.Content,
            AuthorId = post.AuthorId,
            CreatedAtUtc = post.CreatedAtUtc,
            UpdatedAtUtc = post.UpdatedAtUtc,
            LikeCount = post.LikeCount,
            CommentCount = post.CommentCount,
            MediaUrls = post.Media?.Select(m => m.Url).ToList() ?? new List<string>(),
            DistanceMeters = null
        };
    }

    private static PostListDto MapToPostListDtoWithDistance(PostDocument post, double? distance)
    {
        // Extract lat/lng from Location (GeoJSON format: [lng, lat])
        double? latitude = null;
        double? longitude = null;

        if (post.Location?.Coordinates != null && post.Location.Coordinates.Length >= 2)
        {
            longitude = post.Location.Coordinates[0]; // GeoJSON: [lng, lat]
            latitude = post.Location.Coordinates[1];
        }

        return new PostListDto
        {
            Id = post.Id,
            Title = post.Title,
            Content = post.Content,
            AuthorId = post.AuthorId,
            CreatedAtUtc = post.CreatedAtUtc,
            UpdatedAtUtc = post.UpdatedAtUtc,
            LikeCount = post.LikeCount,
            CommentCount = post.CommentCount,
            MediaUrls = post.Media?.Select(m => m.Url).ToList() ?? new List<string>(),
            Latitude = latitude,
            Longitude = longitude,
            DistanceMeters = distance
        };
    }

    // FEED API IMPLEMENTATIONS

    public async Task<IEnumerable<PostListDto>> GetNearbyPostsAsync(double lat, double lon, int radiusMeters, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("📍 Getting nearby posts: lat={Lat}, lon={Lon}, radius={Radius}m, page={Page}", lat, lon, radiusMeters, page);

        var skip = (page - 1) * pageSize;

        var filter = Builders<PostDocument>.Filter.Near(
            p => p.Location,
            lon, lat, // GeoJSON format: longitude first
            radiusMeters
        );

        var posts = await _postsCollection
            .Find(filter)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        return posts.Select(p => new PostListDto
        {
            Id = p.Id,
            Title = p.Title,
            Content = p.Content,
            AuthorName = p.AuthorName,
            AuthorId = p.AuthorId,
            CreatedAt = p.CreatedAtUtc,
            LikeCount = p.LikeCount,
            CommentCount = p.CommentCount,
            LocationName = p.LocationName,
            MediaUrls = p.Media?.Select(m => m.Url).ToList() ?? new List<string>(),
            Location = p.Location,
            DistanceMeters = CalculateDistance(lat, lon, p.Location?.Coordinates?[1] ?? 0, p.Location?.Coordinates?[0] ?? 0)
        });
    }

    public async Task<int> GetNearbyPostsCountAsync(double lat, double lon, int radiusMeters, CancellationToken cancellationToken = default)
    {
        var filter = Builders<PostDocument>.Filter.Near(
            p => p.Location,
            lon, lat,
            radiusMeters
        );

        return (int)await _postsCollection.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
    }

    public async Task<IEnumerable<PostListDto>> GetPopularPostsAsync(int page, int pageSize, TimeSpan timeWindow, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("🔥 Getting popular posts: page={Page}, timeWindow={TimeWindow}", page, timeWindow);

        var skip = (page - 1) * pageSize;
        var cutoffDate = DateTime.UtcNow.Subtract(timeWindow);

        var filter = Builders<PostDocument>.Filter.Gte(p => p.CreatedAtUtc, cutoffDate);

        var posts = await _postsCollection
            .Find(filter)
            .SortByDescending(p => p.LikeCount + p.CommentCount) // Engagement score
            .ThenByDescending(p => p.CreatedAtUtc)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        return posts.Select(MapToPostListDto);
    }

    public async Task<IEnumerable<PostListDto>> GetLatestPostsAsync(int page, int pageSize, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("🆕 Getting latest posts: page={Page}", page);

        var skip = (page - 1) * pageSize;

        var posts = await _postsCollection
            .Find(FilterDefinition<PostDocument>.Empty)
            .SortByDescending(p => p.CreatedAtUtc)
            .Skip(skip)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        return posts.Select(MapToPostListDto);
    }

    public async Task<int> GetTotalPostsCountAsync(CancellationToken cancellationToken = default)
    {
        return (int)await _postsCollection.CountDocumentsAsync(FilterDefinition<PostDocument>.Empty, cancellationToken: cancellationToken);
    }

    private static PostListDto MapToPostListDtoWithNowMetrics(
        PostDocument post,
        double? distance,
        int? freshnessSec,
        bool isLive,
        double? decayScore)
    {
        // Extract lat/lng from Location (GeoJSON format: [lng, lat])
        double? latitude = null;
        double? longitude = null;

        if (post.Location?.Coordinates != null && post.Location.Coordinates.Length >= 2)
        {
            longitude = post.Location.Coordinates[0]; // GeoJSON: [lng, lat]
            latitude = post.Location.Coordinates[1];
        }

        return new PostListDto
        {
            Id = post.Id,
            Title = post.Title,
            Content = post.Content,
            AuthorId = post.AuthorId,
            AuthorName = post.AuthorName ?? "Unknown",
            CreatedAt = post.CreatedAtUtc,
            CreatedAtUtc = post.CreatedAtUtc,
            UpdatedAtUtc = post.UpdatedAtUtc,
            LikeCount = post.LikeCount,
            CommentCount = post.CommentCount,
            MediaUrls = post.Media?.Where(m => !string.IsNullOrWhiteSpace(m.Url))
                                  .Select(m => m.Url)
                                  .ToList() ?? new List<string>(),
            LocationName = post.LocationName,
            Latitude = latitude,
            Longitude = longitude,
            DistanceMeters = distance,
            FreshnessSec = freshnessSec,
            IsLive = isLive,
            DecayScore = decayScore
        };
    }

    private static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadius = 6371000; // Earth radius in meters

        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return earthRadius * c;
    }

    /// <summary>
    /// Debug method to check posts with location data
    /// </summary>
    public async Task<int> DebugCheckLocationPostsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            // Count all posts
            var totalPosts = await _postsCollection.CountDocumentsAsync(FilterDefinition<PostDocument>.Empty, cancellationToken: cancellationToken);

            // Count posts with location
            var postsWithLocation = await _postsCollection.CountDocumentsAsync(
                Builders<PostDocument>.Filter.Ne(p => p.Location, null),
                cancellationToken: cancellationToken);

            _logger.LogInformation("📋 MongoDB Debug: Total posts={TotalPosts}, Posts with Location={PostsWithLocation}",
                totalPosts, postsWithLocation);

            // Get sample posts with location
            var samplePosts = await _postsCollection.Find(
                Builders<PostDocument>.Filter.Ne(p => p.Location, null))
                .Limit(3)
                .ToListAsync(cancellationToken);
                
            foreach (var post in samplePosts)
            {
                if (post.Location?.Coordinates != null && post.Location.Coordinates.Length >= 2)
                {
                    // GeoJSON Point coordinates: [longitude, latitude]
                    var lon = post.Location.Coordinates[0]; // Longitude
                    var lat = post.Location.Coordinates[1]; // Latitude
                    _logger.LogInformation("🗺️ Sample post with location: Title='{Title}', Location=[{Lon}, {Lat}], LocationName='{LocationName}'",
                        post.Title, lon, lat, post.LocationName);
                }
                else
                {
                    _logger.LogInformation("🗺️ Sample post: Title='{Title}', Location=null, LocationName='{LocationName}'",
                        post.Title, post.LocationName);
                }
            }

            return (int)postsWithLocation;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to debug location posts");
            return -1;
        }
    }

    /// <summary>
    /// Integration test helper method for nearby query validation
    /// </summary>
    /// <param name="lat">Test latitude</param>
    /// <param name="lon">Test longitude</param>
    /// <param name="radius">Search radius in meters</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Test validation results</returns>
    public async Task<(bool Success, string Message, int ItemCount, long Total, int TotalPages, bool HasNext, bool HasPrevious, double? TopDecayScore)> 
        TestNearbyQueryAsync(double lat, double lon, int radius = 5000, CancellationToken cancellationToken = default)
    {
        try
        {
            var query = new NearbyQuery
            {
                Lat = lat,
                Lon = lon,
                RadiusMeters = radius,
                SinceMinutes = 1440, // 24 hours
                Page = 1,
                PageSize = 20
            };

            var result = await GetNearbyAsync(query, cancellationToken);

            var success = result.Items.Any() && 
                         result.Total >= result.Items.Count() && 
                         result.TotalPages >= 1;

            var topDecayScore = result.Items.FirstOrDefault()?.DecayScore;

            var message = success 
                ? $"✅ Test passed: Found {result.Items.Count()} items, Total={result.Total}, Pages={result.TotalPages}, TopScore={topDecayScore:F4}"
                : $"❌ Test failed: Items={result.Items.Count()}, Total={result.Total}, Pages={result.TotalPages}";

            _logger.LogInformation("🧪 Nearby query test result: {Message}", message);

            return (success, message, result.Items.Count(), result.Total, result.TotalPages, 
                   result.HasNext, result.HasPrevious, topDecayScore);
        }
        catch (Exception ex)
        {
            var errorMessage = $"❌ Test exception: {ex.Message}";
            _logger.LogError(ex, "🧪 Nearby query test failed: {Error}", errorMessage);
            return (false, errorMessage, 0, 0, 0, false, false, null);
        }
    }
}
