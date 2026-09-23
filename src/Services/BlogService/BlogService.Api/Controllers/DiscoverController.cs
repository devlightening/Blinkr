using BlogService.Api.Extensions;
using BlogService.Api.Services;
using BlogService.Application.Common.ReadModels;
using BlogService.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;
using Shared.Moderation;

namespace BlogService.Api.Controllers;

public record DiscoverMediaDto(string Url, string? ThumbnailUrl, string Type);
public record DiscoverItemDto(
    Guid Id, string Title, string Content, string SignalType, string? SignalValue,
    Guid? AuthorId, string AuthorName, bool Anonymous,
    DateTime CreatedAtUtc, DateTime? ExpiresAtUtc, bool Expired,
    int LikeCount, int CommentCount, bool IsLikedByCurrentUser,
    Guid? PlaceId, string? LocationName, int? DistanceMeters, IReadOnlyList<DiscoverMediaDto> Media, bool Sensitive);
public record DiscoverPageDto(IReadOnlyList<DiscoverItemDto> Items, int Page, int PageSize, bool HasMore);

/// <summary>
/// Keşfet (sinyal-mvp-plan Faz 7): "Yakınımda" - live public signals around a point, ranked by freshness, distance and
/// a little engagement, at most two per person per page; "Takip" - what the people I follow shared this week. Both are
/// place-first signals (no other kind of post exists). Anonymous signals never carry their author, feed distances are
/// coarse, and blocked people are left out when the identity service can say who they are.
/// </summary>
[ApiController]
[Route("api/discover")]
[Authorize]
public class DiscoverController : ControllerBase
{
    private const int CandidateLimit = 300;
    private const int DefaultRadius = 3000;
    private const int MaxRadius = 10000;
    private static readonly TimeSpan FollowingWindow = TimeSpan.FromDays(7);

    private readonly IMongoCollection<PostDocument> _posts;
    private readonly SocialGraphClient _graph;

    public DiscoverController(IMongoDatabase database, SocialGraphClient graph)
    {
        _posts = database.GetCollection<PostDocument>("posts");
        _graph = graph;
    }

    /// <summary>GET /api/discover/nearby?lat&amp;lon&amp;radiusMeters&amp;page&amp;pageSize</summary>
    [HttpGet("nearby")]
    public async Task<IActionResult> Nearby([FromQuery] double lat, [FromQuery] double lon, [FromQuery] int radiusMeters = DefaultRadius,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        if (!double.IsFinite(lat) || !double.IsFinite(lon) || lat is < -90 or > 90 || lon is < -180 or > 180)
            return BadRequest(new { code = "INVALID_LOCATION" });
        radiusMeters = Math.Clamp(radiusMeters, 200, MaxRadius);
        page = Math.Clamp(page, 1, 20);
        pageSize = Math.Clamp(pageSize, 1, 30);
        var now = DateTime.UtcNow;
        var me = User.GetUserId();

        var filter = Builders<PostDocument>.Filter.And(
            Builders<PostDocument>.Filter.Eq(p => p.AudienceType, "Public"),
            Builders<PostDocument>.Filter.Gt(p => p.ExpiresAt, now),
            Builders<PostDocument>.Filter.NearSphere(p => p.Location, GeoJson.Point(GeoJson.Geographic(lon, lat)), maxDistance: radiusMeters));
        var docs = await _posts.Find(filter).Limit(CandidateLimit).ToListAsync(ct);

        var graph = await _graph.GetAsync(ct);
        var hidden = graph?.Hidden ?? new HashSet<Guid>();
        var visible = docs.Where(d => d.IdentityDisclosure == "AnonymousMap" || !hidden.Contains(d.AuthorId)).ToList();
        var byId = visible.ToDictionary(d => d.Id);
        var ordered = DiscoverRanking.Order(visible.Select(d => new DiscoverRanking.Candidate(
            d.Id, d.AuthorId, d.IdentityDisclosure == "AnonymousMap", d.CreatedAtUtc, DistanceOf(d, lat, lon), d.LikeCount, d.CommentCount, ContentTextFilter.IsSensitive(d.Title, d.Content))), now, pageSize);

        var slice = ordered.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(c => ToItem(byId[c.PostId], me, now, DiscoverRanking.CoarseDistance(c.DistanceMeters))).ToList();
        Response.Headers.CacheControl = "private, no-store";
        return Ok(new DiscoverPageDto(slice, page, pageSize, page * pageSize < ordered.Count));
    }

    /// <summary>GET /api/discover/following?page&amp;pageSize - newest first, last 7 days, never anonymous signals.</summary>
    [HttpGet("following")]
    public async Task<IActionResult> Following([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        page = Math.Clamp(page, 1, 50);
        pageSize = Math.Clamp(pageSize, 1, 30);
        var graph = await _graph.GetAsync(ct);
        if (graph is null) return StatusCode(StatusCodes.Status503ServiceUnavailable, new { code = "FEED_UNAVAILABLE" });
        Response.Headers.CacheControl = "private, no-store";
        var ids = graph.Following.Where(id => !graph.Hidden.Contains(id)).ToList();
        if (ids.Count == 0) return Ok(new DiscoverPageDto(Array.Empty<DiscoverItemDto>(), page, pageSize, false));

        var now = DateTime.UtcNow;
        var filter = Builders<PostDocument>.Filter.And(
            Builders<PostDocument>.Filter.In(p => p.AuthorId, ids),
            Builders<PostDocument>.Filter.Eq(p => p.AudienceType, "Public"),
            Builders<PostDocument>.Filter.Ne(p => p.IdentityDisclosure, "AnonymousMap"),
            Builders<PostDocument>.Filter.Gt(p => p.CreatedAtUtc, now - FollowingWindow));
        var docs = await _posts.Find(filter).SortByDescending(p => p.CreatedAtUtc).Skip((page - 1) * pageSize).Limit(pageSize + 1).ToListAsync(ct);
        var me = User.GetUserId();
        var items = docs.Take(pageSize).Select(d => ToItem(d, me, now, null)).ToList();
        return Ok(new DiscoverPageDto(items, page, pageSize, docs.Count > pageSize));
    }

    private static double DistanceOf(PostDocument d, double lat, double lon)
    {
        if (d.Location?.Coordinates is null) return double.MaxValue;
        const double R = 6371000;
        var pLat = d.Location.Coordinates.Latitude;
        var dLat = (pLat - lat) * Math.PI / 180;
        var dLon = (d.Location.Coordinates.Longitude - lon) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(lat * Math.PI / 180) * Math.Cos(pLat * Math.PI / 180) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * R * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static DiscoverItemDto ToItem(PostDocument d, Guid? me, DateTime now, int? distance)
    {
        var anonymous = d.IdentityDisclosure == "AnonymousMap";
        return new DiscoverItemDto(
            d.Id, d.Title, d.Content, d.SignalType, d.SignalValue,
            anonymous ? null : d.AuthorId, anonymous ? "Topluluk üyesi" : d.AuthorName ?? "Blinkr kullanıcısı", anonymous,
            d.CreatedAtUtc, d.ExpiresAt, d.ExpiresAt.HasValue && d.ExpiresAt <= now,
            d.LikeCount, d.CommentCount, me.HasValue && (d.LikedByUserIds?.Contains(me.Value) ?? false),
            d.PlaceId, d.LocationName, distance,
            (d.Media ?? new()).Select(m => new DiscoverMediaDto(m.Url, m.ThumbnailUrl, m.Type)).ToList(),
            ContentTextFilter.IsSensitive(d.Title, d.Content));
    }
}
