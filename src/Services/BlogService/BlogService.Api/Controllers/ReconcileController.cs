using System.Text.Json;
using BlogService.Application.Common.ReadModels;
using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Entities;
using BlogService.Domain.Events;
using EventStore.Client;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BlogService.Api.Controllers;

public record ReconcileIssue(Guid PostId, string Kind, string Detail, string? Action = null);
public record ReconcileReport(int Checked, int Healthy, IReadOnlyList<ReconcileIssue> Issues, bool Repaired);

/// <summary>
/// POST /api/admin/read-models/reconcile?repair=false&amp;limit=300 (CLAUDE.md §21 P1): compares the newest signals in
/// EventStore (the source of truth) with the Mongo read model and, with <c>repair=true</c>, fixes what differs.
/// <list type="bullet">
/// <item><c>missing</c> - created in EventStore, not deleted, but in neither "posts" nor "posts_moderated": its
/// PostCreated event is published again (the worker projects it; run again afterwards for its likes and comments).</item>
/// <item><c>deleted-but-visible</c> - deleted in EventStore, still in "posts": its PostDeleted event is published again
/// (worker and PlaceService remove it).</item>
/// <item><c>likes</c> / <c>reactions</c> - likers or emojis differ: set from the aggregate.</item>
/// <item><c>comments</c> - a comment removed in EventStore is still shown (pulled) or one is missing (its PostCommentAdded
/// is published again); <c>comment-likes</c> - a comment's likers differ (set from the aggregate).</item>
/// </list>
/// Read-only by default. Consumers are idempotent, so republishing never double counts.
/// </summary>
[ApiController]
[Route("api/admin/read-models")]
[Authorize(Policy = "api.admin")]
public class ReconcileController : ControllerBase
{
    private const string CreatedTypePrefix = "BlogService.Domain.Events.PostCreatedEvent";
    private readonly EventStoreClient _eventStore;
    private readonly IMongoCollection<PostDocument> _posts;
    private readonly IMongoCollection<BsonDocument> _moderated;
    private readonly EventStoreToRabbitMqPublisher _publisher;
    private readonly ILogger<ReconcileController> _logger;

    public ReconcileController(EventStoreClient eventStore, IMongoDatabase database, EventStoreToRabbitMqPublisher publisher, ILogger<ReconcileController> logger)
    {
        _eventStore = eventStore;
        _posts = database.GetCollection<PostDocument>("posts");
        _moderated = database.GetCollection<BsonDocument>("posts_moderated");
        _publisher = publisher;
        _logger = logger;
    }

    [HttpPost("reconcile")]
    public async Task<IActionResult> Reconcile([FromQuery] bool repair = false, [FromQuery] int limit = 300, [FromQuery] Guid? postId = null, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 5000);
        var ids = postId is { } one ? new List<Guid> { one } : await RecentPostIdsAsync(limit, ct);
        var issues = new List<ReconcileIssue>();
        var healthy = 0;
        foreach (var id in ids)
        {
            var events = await StreamAsync(id, ct);
            if (events.Count == 0) continue;
            var aggregate = new PostAggregate();
            aggregate.LoadFromHistory(events);
            var found = await CheckAsync(id, aggregate, events, repair, ct);
            if (found.Count == 0) healthy++;
            issues.AddRange(found);
        }
        _logger.LogInformation("Reconcile | Checked={Checked} | Issues={Issues} | Repair={Repair}", ids.Count, issues.Count, repair);
        return Ok(new ReconcileReport(ids.Count, healthy, issues, repair));
    }

    private async Task<List<ReconcileIssue>> CheckAsync(Guid id, PostAggregate aggregate, List<IDomainEvent> events, bool repair, CancellationToken ct)
    {
        var issues = new List<ReconcileIssue>();
        var doc = await _posts.Find(p => p.Id == id).FirstOrDefaultAsync(ct);

        if (aggregate.IsDeleted)
        {
            if (doc is null) return issues;
            var deleted = events.OfType<PostDeletedEvent>().LastOrDefault();
            var action = repair && deleted is not null && await _publisher.RepublishAsync(deleted, ct) ? "PostDeleted republished" : null;
            issues.Add(new ReconcileIssue(id, "deleted-but-visible", "deleted in EventStore, still in posts", action));
            return issues;
        }

        if (doc is null)
        {
            if (await _moderated.Find(new BsonDocument("_id", id.ToString())).AnyAsync(ct)) return issues; // hidden by moderation: by design
            var created = events.OfType<PostCreatedEvent>().FirstOrDefault();
            var action = repair && created is not null && await _publisher.RepublishAsync(created, ct) ? "PostCreated republished" : null;
            issues.Add(new ReconcileIssue(id, "missing", "in EventStore, not in the read model", action));
            return issues;
        }

        var update = new List<UpdateDefinition<PostDocument>>();
        var u = Builders<PostDocument>.Update;

        // Likes and reactions.
        var likers = aggregate.Likes.Select(l => l.UserId).ToHashSet();
        var docLikers = (doc.LikedByUserIds ?? new List<Guid>()).ToHashSet();
        if (!likers.SetEquals(docLikers) || doc.LikeCount != likers.Count)
        {
            issues.Add(new ReconcileIssue(id, "likes", $"aggregate {likers.Count}, read model {doc.LikeCount} ({docLikers.Count} ids)", repair ? "likes set from the aggregate" : null));
            update.Add(u.Set(p => p.LikedByUserIds, likers.ToList()).Set(p => p.LikeCount, likers.Count));
        }
        var want = aggregate.Likes.ToDictionary(l => l.UserId, l => Shared.Events.Text.ReactionCatalog.OrHeart(l.Reaction));
        var have = (doc.Reactions ?? new List<PostReactionReadModel>()).ToDictionary(r => r.UserId, r => Shared.Events.Text.ReactionCatalog.OrHeart(r.Reaction));
        foreach (var legacy in docLikers.Where(x => !have.ContainsKey(x))) have[legacy] = Shared.Events.Text.ReactionCatalog.Heart;
        if (want.Count != have.Count || want.Any(kv => !have.TryGetValue(kv.Key, out var r) || r != kv.Value))
        {
            issues.Add(new ReconcileIssue(id, "reactions", "emojis differ from the aggregate", repair ? "reactions set from the aggregate" : null));
            var now = DateTime.UtcNow;
            update.Add(u.Set(p => p.Reactions, want.Select(kv => new PostReactionReadModel { UserId = kv.Key, Reaction = kv.Value, AtUtc = now }).ToList()));
        }

        // Comments.
        var aggregateComments = aggregate.Comments.ToDictionary(c => c.Id);
        var docComments = (doc.Comments ?? new List<PostCommentReadModel>()).ToDictionary(c => c.Id);
        var extra = docComments.Keys.Where(k => !aggregateComments.ContainsKey(k)).ToList();
        var missing = aggregateComments.Keys.Where(k => !docComments.ContainsKey(k)).ToList();
        if (extra.Count > 0)
        {
            issues.Add(new ReconcileIssue(id, "comments", $"{extra.Count} removed comment(s) still shown", repair ? "removed comments pulled" : null));
            update.Add(u.PullFilter(p => p.Comments, c => extra.Contains(c.Id)));
        }
        if (missing.Count > 0)
        {
            var republished = 0;
            if (repair)
                foreach (var added in events.OfType<PostCommentAddedEvent>().Where(e => missing.Contains(e.CommentId)))
                    if (await _publisher.RepublishAsync(added, ct)) republished++;
            issues.Add(new ReconcileIssue(id, "comments", $"{missing.Count} comment(s) missing", repair ? $"{republished} PostCommentAdded republished" : null));
        }

        if (repair && update.Count > 0)
            await _posts.UpdateOneAsync(p => p.Id == id, u.Combine(update), cancellationToken: ct);

        // Comment likes (after the comment list is right).
        foreach (var (commentId, comment) in aggregateComments)
        {
            if (!docComments.TryGetValue(commentId, out var docComment)) continue;
            var wantLikers = comment.LikerIds.ToHashSet();
            if (wantLikers.SetEquals(docComment.LikedBy ?? new List<Guid>())) continue;
            issues.Add(new ReconcileIssue(id, "comment-likes", $"comment {commentId}: aggregate {wantLikers.Count}, read model {docComment.LikedBy?.Count ?? 0}", repair ? "likers set from the aggregate" : null));
            if (repair)
                await _posts.UpdateOneAsync(
                    Builders<PostDocument>.Filter.And(Builders<PostDocument>.Filter.Eq(p => p.Id, id), Builders<PostDocument>.Filter.ElemMatch(p => p.Comments, c => c.Id == commentId)),
                    u.Set<List<Guid>>("Comments.$.LikedBy", wantLikers.ToList()), cancellationToken: ct);
        }
        return issues;
    }

    /// <summary>The newest created signals, reading EventStore's $all backwards (this client version cannot filter on the
    /// server): stops at <paramref name="limit"/> signals or after a bounded scan.</summary>
    private async Task<List<Guid>> RecentPostIdsAsync(int limit, CancellationToken ct)
    {
        var ids = new List<Guid>();
        var scanCap = Math.Min(2_000_000L, limit * 400L);
        var read = _eventStore.ReadAllAsync(Direction.Backwards, Position.End, scanCap, cancellationToken: ct);
        await foreach (var resolved in read.WithCancellation(ct))
        {
            if (!resolved.Event.EventType.StartsWith(CreatedTypePrefix, StringComparison.Ordinal)) continue;
            using var json = JsonDocument.Parse(resolved.Event.Data);
            if (json.RootElement.TryGetProperty("PostId", out var p) && p.TryGetGuid(out var id) && !ids.Contains(id)) ids.Add(id);
            if (ids.Count >= limit) break;
        }
        return ids;
    }

    private async Task<List<IDomainEvent>> StreamAsync(Guid id, CancellationToken ct)
    {
        var events = new List<IDomainEvent>();
        var read = _eventStore.ReadStreamAsync(Direction.Forwards, $"{nameof(PostAggregate)}-{id}", StreamPosition.Start, cancellationToken: ct);
        if (await read.ReadState == ReadState.StreamNotFound) return events;
        await foreach (var resolved in read.WithCancellation(ct))
        {
            var type = Type.GetType(resolved.Event.EventType);
            if (type is null) continue;
            if (JsonSerializer.Deserialize(resolved.Event.Data.Span, type) is IDomainEvent e) events.Add(e);
        }
        return events;
    }
}
