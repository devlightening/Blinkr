using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Helpers;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using Microsoft.Extensions.Caching.Distributed;
using MongoDB.Driver;
using Shared.Events.Events.Identity;

namespace Blinkr.Projections.Worker.Consumers;

/// <summary>
/// Hides, restores or removes a signal after reports or a moderator decision (sinyal-mvp-plan Faz 10 P10.3/P10.4).
/// A hidden or removed post is moved out of "posts" into "posts_moderated", so no public read path (map, feeds, search,
/// profile, detail) can show it by forgetting a filter; restoring moves it back. Each step writes the target before
/// deleting the source, so a repeat or a crash in between only leaves work for the retry, never a lost post.
/// While hidden, likes/comments/edits on it are not projected (the source document is not in "posts").
/// </summary>
public class PostModerationChangedConsumer : IConsumer<PostModerationChangedIntegrationEvent>
{
    public const string ModeratedCollection = "posts_moderated";

    private readonly IMongoCollection<PostDocument> _posts;
    private readonly IMongoCollection<PostDocument> _moderated;
    private readonly ILogger<PostModerationChangedConsumer> _logger;
    private readonly IDistributedCache _cache;
    private readonly ProjectionInbox _inbox;

    public PostModerationChangedConsumer(IMongoDatabase database, ILogger<PostModerationChangedConsumer> logger, IDistributedCache cache, ProjectionInbox inbox)
    {
        _posts = database.GetCollection<PostDocument>("posts");
        _moderated = database.GetCollection<PostDocument>(ModeratedCollection);
        _logger = logger;
        _cache = cache;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostModerationChangedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostModerationChangedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName)) return;

        var message = context.Message;
        var ct = context.CancellationToken;
        try
        {
            var byId = Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId);
            var moved = false;
            if (message.State == PostModerationChangedIntegrationEvent.Visible)
            {
                var doc = await _moderated.Find(byId).FirstOrDefaultAsync(ct);
                if (doc is not null)
                {
                    doc.ModerationState = null;
                    await _posts.ReplaceOneAsync(byId, doc, new ReplaceOptions { IsUpsert = true }, ct);
                    await _moderated.DeleteOneAsync(byId, ct);
                    moved = true;
                }
            }
            else
            {
                var doc = await _posts.Find(byId).FirstOrDefaultAsync(ct);
                if (doc is not null)
                {
                    doc.ModerationState = message.State;
                    await _moderated.ReplaceOneAsync(byId, doc, new ReplaceOptions { IsUpsert = true }, ct);
                    await _posts.DeleteOneAsync(byId, ct);
                    moved = true;
                }
                else
                {
                    // Already out of "posts" (hidden before, now removed): only the state changes.
                    await _moderated.UpdateOneAsync(byId, Builders<PostDocument>.Update.Set(p => p.ModerationState, message.State), cancellationToken: ct);
                }
            }

            await CacheInvalidationHelper.InvalidatePostCache(_cache, message.PostId);
            _logger.LogInformation("Moderation state projected. PostId={PostId}, State={State}, Moved={Moved}", message.PostId, message.State, moved);
            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error projecting moderation state for PostId: {PostId}", message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}
