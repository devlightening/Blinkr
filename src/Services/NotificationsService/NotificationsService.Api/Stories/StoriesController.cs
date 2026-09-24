using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using NotificationsService.Application.Snaps;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Enums;
using NotificationsService.Domain.Interfaces;
using Shared.Moderation;

namespace NotificationsService.Api.Stories;

/// <summary>
/// Stories (sinyal-mvp-plan Faz 7 P7.5): post a photo or clip that lives 24 h; the tray lists my own and the people I
/// follow; seen state and a viewers list for my own. Visibility is decided here with the identity service (follows and
/// blocks) and fails closed when it cannot answer. Media is private, never cached, EXIF-free.
/// </summary>
[ApiController]
[Route("api/stories")]
[Authorize]
public class StoriesController : ControllerBase
{
    private const int MaxRequestBytes = 41 * 1024 * 1024;
    private readonly IMongoCollection<StoryDocument> _stories;
    private readonly ISnapStorage _storage;
    private readonly SnapSettings _settings;
    private readonly FollowGraphClient _graph;
    private readonly INotificationRepository _notifications;
    private readonly ILogger<StoriesController> _logger;

    public StoriesController(IMongoDatabase database, ISnapStorage storage, SnapSettings settings, FollowGraphClient graph, INotificationRepository notifications, ILogger<StoriesController> logger)
    {
        _notifications = notifications;
        _stories = database.GetCollection<StoryDocument>("stories");
        _storage = storage;
        _settings = settings;
        _graph = graph;
        _logger = logger;
    }

    private Guid Me() => User.GetUserId();
    private string MyName() => User.FindFirst("preferred_username")?.Value ?? User.FindFirst("name")?.Value ?? User.Identity?.Name ?? "Blinkr";

    private static bool CanSee(Guid me, Guid author, FollowGraph graph) =>
        author == me || (graph.Following.Contains(author) && !graph.Hidden.Contains(author));

    /// <summary>POST /api/stories?durationSeconds&amp;caption - raw media body, Content-Type = its type.</summary>
    [HttpPost]
    [RequestSizeLimit(MaxRequestBytes)]
    public async Task<IActionResult> Create([FromQuery] int durationSeconds = 5, [FromQuery] string? caption = null, CancellationToken ct = default)
    {
        // Moderation sanction (Faz 10 P10.4): no posting while restricted; carried in the access token.
        if (PostingRestriction.RestrictedUntil(User, DateTime.UtcNow) is { } restrictedUntil)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = PostingRestriction.ErrorCode, code = PostingRestriction.ErrorCode, until = restrictedUntil, message = "Topluluk kuralları nedeniyle şu an paylaşım yapamazsın." });
        var captionReview = ContentTextFilter.Review(caption);
        if (captionReview.Verdict == TextVerdict.Blocked) return UnprocessableEntity(new { code = ContentTextFilter.BlockedCode, message = "Bu içerik topluluk kurallarına uymuyor." });
        caption = captionReview.Text;
        var me = Me();
        var contentType = SnapMedia.NormalizeContentType(Request.ContentType);
        var isImage = SnapMedia.IsImage(contentType);
        var isVideo = SnapMedia.IsVideo(contentType);
        if (!isImage && !isVideo) return BadRequest(new { code = "UNSUPPORTED_MEDIA" });

        await using var buffer = new MemoryStream();
        await Request.Body.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();
        var max = isVideo ? _settings.MaxVideoBytes : _settings.MaxImageBytes;
        if (bytes.Length == 0 || bytes.Length > max) return BadRequest(new { code = "MEDIA_SIZE" });
        if (!SnapMedia.LooksValid(bytes, contentType)) return BadRequest(new { code = "MEDIA_MISMATCH" });
        if (isImage && !StoryRules.PhotoDurations.Contains(durationSeconds)) return BadRequest(new { code = "INVALID_DURATION" });

        var now = DateTime.UtcNow;
        if (await _stories.CountDocumentsAsync(s => s.AuthorId == me && s.ExpiresAtUtc > now, cancellationToken: ct) >= StoryRules.MaxActivePerAuthor)
            return StatusCode(StatusCodes.Status429TooManyRequests, new { code = "TOO_MANY_STORIES" });

        var clean = contentType == "image/jpeg" ? SnapMedia.StripJpegMetadata(bytes) : bytes;
        var story = new StoryDocument
        {
            AuthorId = me,
            AuthorName = MyName(),
            ContentType = contentType,
            MediaType = isVideo ? "Video" : "Image",
            Caption = string.IsNullOrWhiteSpace(caption) ? null : caption.Trim()[..Math.Min(caption.Trim().Length, StoryRules.MaxCaptionLength)],
            DurationSeconds = isVideo ? 0 : durationSeconds,
            CreatedAtUtc = now,
            ExpiresAtUtc = now + StoryRules.Lifetime,
        };
        story.MediaKey = $"stories/{story.Id}";
        await _storage.SaveAsync(story.MediaKey, clean, ct);
        await _stories.InsertOneAsync(story, cancellationToken: ct);
        _logger.LogInformation("Story created | StoryId={StoryId} | Bytes={Bytes}", story.Id, clean.Length);
        return Ok(ToDto(story, me));
    }

    /// <summary>GET /api/stories/tray - my own and the people I follow, with active stories.</summary>
    [HttpGet("tray")]
    public async Task<IActionResult> Tray(CancellationToken ct)
    {
        var me = Me();
        var graph = await _graph.GetAsync(ct);
        if (graph is null) return StatusCode(StatusCodes.Status503ServiceUnavailable, new { code = "STORIES_UNAVAILABLE" });
        var authors = graph.Following.Where(id => !graph.Hidden.Contains(id)).Append(me).ToHashSet();
        var now = DateTime.UtcNow;
        var active = await _stories.Find(s => authors.Contains(s.AuthorId) && s.ExpiresAtUtc > now).ToListAsync(ct);
        var items = active.GroupBy(s => s.AuthorId).Select(g => new StoryTrayItemDto(
            g.Key, g.OrderByDescending(s => s.CreatedAtUtc).First().AuthorName, g.Key == me, g.Count(),
            g.Max(s => s.CreatedAtUtc), g.Key == me || g.All(s => s.Views.Any(v => v.UserId == me))));
        Response.Headers.CacheControl = "private, no-store";
        return Ok(StoryRules.Order(items).ToList());
    }

    /// <summary>GET /api/stories/users/{authorId} - their active stories, oldest first (the order they are watched).</summary>
    [HttpGet("users/{authorId:guid}")]
    public async Task<IActionResult> ByAuthor(Guid authorId, CancellationToken ct)
    {
        var me = Me();
        if (authorId != me)
        {
            var graph = await _graph.GetAsync(ct);
            if (graph is null) return StatusCode(StatusCodes.Status503ServiceUnavailable, new { code = "STORIES_UNAVAILABLE" });
            if (!CanSee(me, authorId, graph)) return StatusCode(StatusCodes.Status403Forbidden, new { code = "STORY_FORBIDDEN" });
        }
        var now = DateTime.UtcNow;
        var stories = await _stories.Find(s => s.AuthorId == authorId && s.ExpiresAtUtc > now).SortBy(s => s.CreatedAtUtc).ToListAsync(ct);
        Response.Headers.CacheControl = "private, no-store";
        return Ok(stories.Select(s => ToDto(s, me)).ToList());
    }

    /// <summary>GET /api/stories/{id}/content - the media, only for someone allowed to see it, never cached.</summary>
    [HttpGet("{id}/content")]
    public async Task<IActionResult> Content(string id, CancellationToken ct)
    {
        var (story, error) = await LoadVisibleAsync(id, ct);
        if (story is null) return error!;
        var bytes = await _storage.ReadAsync(story.MediaKey, ct);
        if (bytes is null) return StatusCode(StatusCodes.Status410Gone, new { code = "STORY_EXPIRED" });
        Response.Headers.CacheControl = "no-store, no-cache, max-age=0";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(bytes, story.ContentType);
    }

    /// <summary>POST /api/stories/{id}/seen - idempotent; the author seeing their own story is not a view.</summary>
    [HttpPost("{id}/seen")]
    public async Task<IActionResult> Seen(string id, CancellationToken ct)
    {
        var (story, error) = await LoadVisibleAsync(id, ct);
        if (story is null) return error!;
        var me = Me();
        if (story.AuthorId != me)
        {
            var filter = Builders<StoryDocument>.Filter.And(
                Builders<StoryDocument>.Filter.Eq(s => s.Id, id),
                Builders<StoryDocument>.Filter.Not(Builders<StoryDocument>.Filter.ElemMatch(s => s.Views, v => v.UserId == me)));
            await _stories.UpdateOneAsync(filter, Builders<StoryDocument>.Update.Push(s => s.Views, new StoryView { UserId = me, UserName = MyName(), SeenAtUtc = DateTime.UtcNow }), cancellationToken: ct);
        }
        return NoContent();
    }

    /// <summary>GET /api/stories/{id}/viewers - only the author.</summary>
    [HttpGet("{id}/viewers")]
    public async Task<IActionResult> Viewers(string id, CancellationToken ct)
    {
        var story = await _stories.Find(s => s.Id == id).FirstOrDefaultAsync(ct);
        if (story is null || story.ExpiresAtUtc <= DateTime.UtcNow) return NotFound(new { code = "STORY_NOT_FOUND" });
        if (story.AuthorId != Me()) return StatusCode(StatusCodes.Status403Forbidden, new { code = "STORY_FORBIDDEN" });
        Response.Headers.CacheControl = "private, no-store";
        var likers = story.Likes.Select(l => l.UserId).ToHashSet();
        return Ok(story.Views.OrderByDescending(v => likers.Contains(v.UserId)).ThenByDescending(v => v.SeenAtUtc)
            .Select(v => new StoryViewerDto(v.UserId, v.UserName, v.SeenAtUtc, likers.Contains(v.UserId))).ToList());
    }

    /// <summary>
    /// POST /api/stories/{id}/like (V2-3) - Instagram's story heart. Idempotent; only someone who may see the story;
    /// not your own. The first like tells the author once ("X hikayeni beğendi"); a like also counts as a view.
    /// </summary>
    [HttpPost("{id}/like")]
    public async Task<IActionResult> Like(string id, CancellationToken ct)
    {
        var (story, error) = await LoadVisibleAsync(id, ct);
        if (story is null) return error!;
        var me = Me();
        if (story.AuthorId == me) return BadRequest(new { code = "SELF" });
        var notYet = Builders<StoryDocument>.Filter.And(
            Builders<StoryDocument>.Filter.Eq(s => s.Id, id),
            Builders<StoryDocument>.Filter.Not(Builders<StoryDocument>.Filter.ElemMatch(s => s.Likes, l => l.UserId == me)));
        var result = await _stories.UpdateOneAsync(notYet, Builders<StoryDocument>.Update.Push(s => s.Likes, new StoryLike { UserId = me, LikedAtUtc = DateTime.UtcNow }), cancellationToken: ct);
        if (result.ModifiedCount == 1)
        {
            await Seen(id, ct);
            var name = MyName();
            // V2-7 (D-029): likes on the same story within an hour share one row ("ayse, mert ve 3 kişi daha ...").
            await _notifications.UpsertGroupedAsync(new Notification
            {
                UserId = story.AuthorId,
                Type = NotificationType.StoryLiked,
                ActorUserId = me,
                ActorUserName = name,
                GroupKey = $"story_like:{id}",
                Content = new() { Title = "Hikaye beğenisi", Body = $"{name} hikayeni beğendi.", DeepLink = $"blinkr://users/{me}" },
                CreatedAtUtc = DateTime.UtcNow,
            }, TimeSpan.FromHours(1), (names, count) => NotificationsService.Domain.ValueObjects.GroupedText.Of(names, count, "hikayeni beğendi."), ct);
            _logger.LogInformation("Story liked | StoryId={StoryId}", id);
        }
        return Ok(new { liked = true });
    }

    /// <summary>DELETE /api/stories/{id}/like - take the heart back (the notification already sent stays).</summary>
    [HttpDelete("{id}/like")]
    public async Task<IActionResult> Unlike(string id, CancellationToken ct)
    {
        var (story, error) = await LoadVisibleAsync(id, ct);
        if (story is null) return error!;
        var me = Me();
        await _stories.UpdateOneAsync(s => s.Id == id, Builders<StoryDocument>.Update.PullFilter(s => s.Likes, l => l.UserId == me), cancellationToken: ct);
        return Ok(new { liked = false });
    }

    /// <summary>DELETE /api/stories/{id} - the author removes it (media deleted at once).</summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        var story = await _stories.Find(s => s.Id == id).FirstOrDefaultAsync(ct);
        if (story is null) return NoContent();
        if (story.AuthorId != Me()) return StatusCode(StatusCodes.Status403Forbidden, new { code = "STORY_FORBIDDEN" });
        await _stories.DeleteOneAsync(s => s.Id == id, ct);
        await _storage.DeleteAsync(story.MediaKey, ct);
        return NoContent();
    }

    private async Task<(StoryDocument? Story, IActionResult? Error)> LoadVisibleAsync(string id, CancellationToken ct)
    {
        var story = await _stories.Find(s => s.Id == id).FirstOrDefaultAsync(ct);
        if (story is null || story.ExpiresAtUtc <= DateTime.UtcNow) return (null, StatusCode(StatusCodes.Status410Gone, new { code = "STORY_EXPIRED" }));
        var me = Me();
        if (story.AuthorId == me) return (story, null);
        var graph = await _graph.GetAsync(ct);
        if (graph is null) return (null, StatusCode(StatusCodes.Status503ServiceUnavailable, new { code = "STORIES_UNAVAILABLE" }));
        return CanSee(me, story.AuthorId, graph) ? (story, null) : (null, StatusCode(StatusCodes.Status403Forbidden, new { code = "STORY_FORBIDDEN" }));
    }

    private static StoryItemDto ToDto(StoryDocument s, Guid me) => new(
        s.Id, s.AuthorId, s.AuthorName, s.MediaType, s.Caption, s.DurationSeconds, s.CreatedAtUtc, s.ExpiresAtUtc,
        s.AuthorId == me || s.Views.Any(v => v.UserId == me), s.AuthorId == me ? s.Views.Count : null,
        s.Likes.Any(l => l.UserId == me), s.AuthorId == me ? s.Likes.Count : null);
}
