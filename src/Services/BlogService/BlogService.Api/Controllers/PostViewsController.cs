using BlogService.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BlogService.Api.Controllers;

public record PostViewsRequest(List<Guid>? PostIds);

/// <summary>
/// Sinyal Kartı views (plan-devam C12): the app sends the signals a person looked at for at least a second, in
/// batches every 10 s. A view is counted once per person, signal and day, and only the author ever sees the number
/// (GET /api/posts/{id} returns it to them as viewCount). Views are a usage count, not content, so they live in their
/// own Mongo collection rather than in the event-sourced post; no location is stored.
/// </summary>
[ApiController]
[Route("api/posts/views")]
[Authorize]
public class PostViewsController : ControllerBase
{
    public const string Collection = "post_views";
    private const int MaxBatch = 50;
    private readonly IMongoCollection<BsonDocument> _views;

    public PostViewsController(IMongoDatabase database) => _views = database.GetCollection<BsonDocument>(Collection);

    [HttpPost]
    public async Task<IActionResult> Record([FromBody] PostViewsRequest request, CancellationToken ct)
    {
        var me = User.GetUserId();
        if (me is null) return Unauthorized();
        var ids = (request?.PostIds ?? new()).Where(id => id != Guid.Empty).Distinct().Take(MaxBatch).ToList();
        if (ids.Count == 0) return Ok(new { recorded = 0 });
        var day = DateTime.UtcNow.ToString("yyyyMMdd");
        var writes = ids.Select(id => new UpdateOneModel<BsonDocument>(
            Builders<BsonDocument>.Filter.Eq("_id", $"{id}:{me}:{day}"),
            Builders<BsonDocument>.Update.SetOnInsert("PostId", id.ToString()).SetOnInsert("Day", day).SetOnInsert("CreatedAtUtc", DateTime.UtcNow))
        { IsUpsert = true }).ToList();
        var result = await _views.BulkWriteAsync(writes, new BulkWriteOptions { IsOrdered = false }, ct);
        return Ok(new { recorded = result.Upserts.Count });
    }
}
