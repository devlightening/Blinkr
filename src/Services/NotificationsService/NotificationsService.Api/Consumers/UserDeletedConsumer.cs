using MassTransit;
using MongoDB.Driver;
using NotificationsService.Api.Stories;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;
using Shared.Events.Events.Identity;

namespace NotificationsService.Api.Consumers;

/// <summary>
/// Erases what NotificationsService holds for a deleted account (plan-devam F3, P10.7). Conversations stay for the
/// other person, but everything the deleted person wrote is emptied ("Mesaj silindi"), their snap files and stories
/// are deleted, their reactions, story views, notifications, device tokens and location subscriptions go. The other
/// person's app shows them as "Silinmiş kullanıcı" because the profile no longer exists. Idempotent.
/// </summary>
public sealed class UserDeletedConsumer : IConsumer<UserDeletedIntegrationEvent>
{
    private const string Removed = "Mesaj silindi";
    private readonly IMongoDatabase _db;
    private readonly ISnapStorage _storage;
    private readonly ILogger<UserDeletedConsumer> _logger;

    public UserDeletedConsumer(IMongoDatabase db, ISnapStorage storage, ILogger<UserDeletedConsumer> logger)
    {
        _db = db;
        _storage = storage;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<UserDeletedIntegrationEvent> context)
    {
        var userId = context.Message.UserId;
        var ct = context.CancellationToken;
        if (userId == Guid.Empty) return;

        var messages = _db.GetCollection<ChatMessage>("chat_messages");
        var conversations = _db.GetCollection<Conversation>("conversations");
        var m = Builders<ChatMessage>.Filter;

        // Snap files first (the rows are emptied below).
        var snaps = await messages.Find(m.Eq(x => x.SenderId, userId) & m.Eq(x => x.Kind, "snap") & m.Ne("Snap.ObjectKey", BsonNull)).ToListAsync(ct);
        foreach (var snap in snaps.Where(s => s.Snap?.ObjectKey is not null))
        {
            try { await _storage.DeleteAsync(snap.Snap!.ObjectKey!, ct); } catch (Exception ex) { _logger.LogWarning(ex, "Snap file could not be deleted | MessageId={MessageId}", snap.Id); }
        }
        await messages.UpdateManyAsync(m.Eq(x => x.SenderId, userId) & m.Eq(x => x.Kind, "snap"),
            Builders<ChatMessage>.Update.Set("Snap.ObjectKey", BsonNull).Set("Snap.State", SnapStates.Expired).Set("Snap.Caption", BsonNull), cancellationToken: ct);

        // Everything they wrote is emptied; their reactions and quotes of their messages go too.
        var written = await messages.UpdateManyAsync(m.Eq(x => x.SenderId, userId) & m.Ne(x => x.Kind, "snap"),
            Builders<ChatMessage>.Update.Set(x => x.Kind, "unsent").Set(x => x.Text, string.Empty).Unset(x => x.Signal).Unset(x => x.ReplyTo).Set(x => x.Reactions, new List<MessageReaction>()), cancellationToken: ct);
        await messages.UpdateManyAsync(m.ElemMatch(x => x.Reactions, r => r.UserId == userId),
            Builders<ChatMessage>.Update.PullFilter(x => x.Reactions, r => r.UserId == userId), cancellationToken: ct);
        await messages.UpdateManyAsync(m.Eq("ReplyTo.SenderId", userId.ToString()),
            Builders<ChatMessage>.Update.Set("ReplyTo.Text", string.Empty).Set("ReplyTo.Kind", "unsent"), cancellationToken: ct);
        await conversations.UpdateManyAsync(
            Builders<Conversation>.Filter.AnyEq(x => x.ParticipantIds, userId) & Builders<Conversation>.Filter.Eq(x => x.LastMessageSenderId, userId),
            Builders<Conversation>.Update.Set(x => x.LastMessagePreview, Removed).Set(x => x.LastMessageKind, "unsent"), cancellationToken: ct);

        // Stories (with their files) and their views of other people's stories.
        var stories = _db.GetCollection<StoryDocument>("stories");
        foreach (var story in await stories.Find(s => s.AuthorId == userId).ToListAsync(ct))
        {
            try { await _storage.DeleteAsync(story.MediaKey, ct); } catch (Exception ex) { _logger.LogWarning(ex, "Story file could not be deleted | StoryId={StoryId}", story.Id); }
        }
        var storiesGone = await stories.DeleteManyAsync(s => s.AuthorId == userId, ct);
        await stories.UpdateManyAsync(Builders<StoryDocument>.Filter.ElemMatch(s => s.Views, v => v.UserId == userId),
            Builders<StoryDocument>.Update.PullFilter(s => s.Views, v => v.UserId == userId), cancellationToken: ct);

        // Notifications to or about them, push tokens, location subscriptions.
        await _db.GetCollection<Notification>("notifications").DeleteManyAsync(n => n.UserId == userId || n.ActorUserId == userId, ct);
        await _db.GetCollection<DeviceToken>("device_tokens").DeleteManyAsync(t => t.UserId == userId, ct);
        await _db.GetCollection<UserLocation>("user_locations").DeleteManyAsync(l => l.UserId == userId, ct);

        _logger.LogInformation("Account erased in NotificationsService | UserId={UserId} | Messages={Messages} | Snaps={Snaps} | Stories={Stories}",
            userId, written.ModifiedCount, snaps.Count, storiesGone.DeletedCount);
    }

    private static readonly MongoDB.Bson.BsonNull BsonNull = MongoDB.Bson.BsonNull.Value;
}
