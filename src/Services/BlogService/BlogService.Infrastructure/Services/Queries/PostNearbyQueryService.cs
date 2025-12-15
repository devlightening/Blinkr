using BlogService.Infrastructure.ReadModels;
using BlogService.Application.DTOs.PostDtos;
using MongoDB.Driver;
using Microsoft.Extensions.Logging;

namespace BlogService.Infrastructure.Services.Queries;

public class PostNearbyQueryService
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostNearbyQueryService> _logger;

    public PostNearbyQueryService(IMongoDatabase database, ILogger<PostNearbyQueryService> logger)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task<PagedResult<PostListDto>> GetNearbyAsync(NearbyQuery query, CancellationToken cancellationToken = default)
    {
        var q = query.Clamp();
        _logger.LogInformation("📍 Nearby query: lat={Lat}, lon={Lon}, radius={Radius}m, sinceMin={SinceMin}, page={Page}",
            q.Lat, q.Lon, q.RadiusMeters, q.SinceMinutes, q.Page);

        try
        {
            var filter = Builders<PostDocument>.Filter.Ne(p => p.Location, null);

            if (q.SinceMinutes > 0)
            {
                var cutoffTime = DateTime.UtcNow.AddMinutes(-q.SinceMinutes);
                filter = Builders<PostDocument>.Filter.And(
                    filter,
                    Builders<PostDocument>.Filter.Gte(p => p.CreatedAtUtc, cutoffTime)
                );
            }

            var allPosts = await _postsCollection
                .Find(filter)
                .SortByDescending(p => p.CreatedAtUtc)
                .ToListAsync(cancellationToken);

            var postsWithDistance = allPosts
                .Select(p => new
                {
                    Post = p,
                    Distance = CalculateDistance(q.Lat, q.Lon, p.Location?.Coordinates)
                })
                .Where(x => x.Distance <= q.RadiusMeters)
                .OrderBy(x => x.Distance)
                .ToList();

            var totalCount = postsWithDistance.Count;
            var skip = (q.Page - 1) * q.PageSize;
            var pagedPosts = postsWithDistance
                .Skip(skip)
                .Take(q.PageSize)
                .ToList();

            var items = pagedPosts.Select(x => MapToPostListDtoWithDistance(x.Post, x.Distance)).ToList();

            _logger.LogInformation("📍 Nearby query completed. Found={Count}/{Total} items", items.Count, totalCount);

            return new PagedResult<PostListDto>(items, total: totalCount, page: q.Page, pageSize: q.PageSize);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error in nearby query: lat={Lat}, lon={Lon}, radius={Radius}m",
                q.Lat, q.Lon, q.RadiusMeters);
            throw;
        }
    }

    private double CalculateDistance(double lat1, double lon1, double[]? coordinates)
    {
        if (coordinates == null || coordinates.Length < 2)
            return double.MaxValue;

        double lat2 = coordinates[1];
        double lon2 = coordinates[0];

        const double earthRadiusMeters = 6371000;
        double dLat = (lat2 - lat1) * Math.PI / 180;
        double dLon = (lon2 - lon1) * Math.PI / 180;

        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                   Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                   Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusMeters * c;
    }

    private PostListDto MapToPostListDtoWithDistance(PostDocument post, double distance)
    {
        return new PostListDto
        {
            Id = post.Id,
            AuthorId = post.AuthorId,
            AuthorName = post.AuthorName ?? "Unknown",
            AuthorGender = post.AuthorGender,
            Title = post.Title,
            Content = post.Content,
            CreatedAtUtc = post.CreatedAtUtc,
            LikeCount = post.LikeCount,
            CommentCount = post.CommentCount,
            MediaUrls = post.Media?.Select(m => m.Url).ToList() ?? new(),
            DistanceMeters = distance,
            FreshnessSec = (int)(DateTime.UtcNow - post.CreatedAtUtc).TotalSeconds,
            DecayScore = CalculateDecayScore(distance, post.LikeCount, post.CreatedAtUtc)
        };
    }

    private double CalculateDecayScore(double distance, int likeCount, DateTime createdAt)
    {
        double distanceScore = Math.Max(0, 1.0 - (distance / 5000.0));
        double likeScore = Math.Min(1.0, likeCount / 100.0);
        double freshnessScore = Math.Max(0, 1.0 - ((DateTime.UtcNow - createdAt).TotalHours / 24.0));

        return (distanceScore * 0.5) + (likeScore * 0.3) + (freshnessScore * 0.2);
    }
}
