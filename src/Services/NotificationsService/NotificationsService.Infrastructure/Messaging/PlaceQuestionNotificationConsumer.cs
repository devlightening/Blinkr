using System.Security.Cryptography;
using System.Text;
using MassTransit;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Enums;
using NotificationsService.Domain.Interfaces;
using Shared.Events.Events.Place;

namespace NotificationsService.Infrastructure.Messaging;

/// <summary>
/// "Yere sor" (D-039): a question someone asked about a place got a verified answer; everyone who asked is told once.
/// Idempotent by construction: each notice's id is derived from the event and the person, so a redelivered event hits
/// a duplicate key and is skipped. The person who answered is not notified about their own answer, and the notice
/// never names who answered (it opens the verified signal, which follows its own anonymity rules).
/// </summary>
public class PlaceQuestionNotificationConsumer : IConsumer<PlaceQuestionAnsweredIntegrationEvent>
{
    private readonly INotificationRepository _notifications;
    private readonly ILogger<PlaceQuestionNotificationConsumer> _log;

    public PlaceQuestionNotificationConsumer(INotificationRepository notifications, ILogger<PlaceQuestionNotificationConsumer> log)
    {
        _notifications = notifications;
        _log = log;
    }

    public async Task Consume(ConsumeContext<PlaceQuestionAnsweredIntegrationEvent> context)
    {
        var m = context.Message;
        var sent = 0;
        foreach (var asker in m.AskerIds.Distinct())
        {
            if (asker == Guid.Empty || (m.AnsweredByAuthorId.HasValue && m.AnsweredByAuthorId == asker)) continue;
            try
            {
                await _notifications.InsertAsync(new Notification
                {
                    Id = NoticeId(m.Id, asker),
                    UserId = asker,
                    Type = NotificationType.PlaceQuestionAnswered,
                    PostId = m.AnswerPostId,
                    Content = new()
                    {
                        Title = $"{m.PlaceName}: sorun yanıtlandı",
                        Body = $"{AnswerLabel(m.AnswerSignalType, m.AnswerValue)} · konumda doğrulandı",
                        DeepLink = $"blinkr://posts/{m.AnswerPostId}",
                    },
                    CreatedAtUtc = DateTime.UtcNow,
                }, context.CancellationToken);
                sent++;
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                // Already told (a redelivered event).
            }
        }
        _log.LogInformation("Place question notices | PlaceId={PlaceId} | QuestionId={QuestionId} | EventId={EventId} | Sent={Sent}", m.PlaceId, m.QuestionId, m.Id, sent);
    }

    /// <summary>A stable ObjectId per event and person.</summary>
    private static string NoticeId(Guid eventId, Guid userId)
    {
        var hash = MD5.HashData(Encoding.UTF8.GetBytes($"place-question-notice:{eventId:N}:{userId:N}"));
        return new ObjectId(hash.AsSpan(0, 12).ToArray()).ToString();
    }

    private static string AnswerLabel(string? type, string? value) => (type, value?.Trim().ToUpperInvariant()) switch
    {
        ("Crowd", "CALM" or "EMPTY") => "Şu an sakin",
        ("Crowd", "MODERATE") => "Şu an hareketli",
        ("Crowd", "BUSY") => "Şu an kalabalık",
        ("Queue", "NONE") => "Sıra yok",
        ("Queue", "5TO15") => "Sıra 5–15 dk",
        ("Queue", "OVER15" or "LONG") => "Sıra 15 dk üzeri",
        ("TemporaryStatus", "OPEN") => "Şu an açık",
        ("TemporaryStatus", "CLOSED") => "Şu an kapalı",
        _ => "Yeni bilgi var",
    };
}
