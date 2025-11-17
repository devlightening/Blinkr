using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Enums;
using NotificationsService.Domain.Interfaces;
using NotificationsService.Infrastructure.Config;
using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;
using MassTransit;
using Shared.Events.Events.Blog;

namespace NotificationsService.Infrastructure.Messaging;

public class EventConsumer : BackgroundService
{
    private readonly ILogger<EventConsumer> _log;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly RabbitOptions _opt;

    private IConnection? _conn;
    private IModel? _ch;

    public EventConsumer(
        ILogger<EventConsumer> log,
        IServiceScopeFactory scopeFactory,
        IOptions<RabbitOptions> opt)
    {
        _log = log;
        _scopeFactory = scopeFactory;
        _opt = opt.Value;
    }

// MassTransit consumers for WS-07A to align with BlogService publishing via MassTransit
public class PostLikedNotificationConsumer : IConsumer<PostLikedIntegrationEvent>
{
    private readonly INotificationRepository _notifRepo;
    private readonly IDeviceTokenRepository _tokenRepo;
    private readonly IPushSender _push;
    private readonly ILogger<PostLikedNotificationConsumer> _log;

    public PostLikedNotificationConsumer(INotificationRepository notifRepo, IDeviceTokenRepository tokenRepo, IPushSender push, ILogger<PostLikedNotificationConsumer> log)
    {
        _notifRepo = notifRepo; _tokenRepo = tokenRepo; _push = push; _log = log;
    }

    public async Task Consume(ConsumeContext<PostLikedIntegrationEvent> context)
    {
        var m = context.Message;
        _log.LogInformation("WS-07-SOCIAL-FIX: MT consume post.liked PostId={PostId}, Owner={Owner}, Liker={Liker}", m.PostId, m.PostOwnerId, m.LikerUserId);

        if (m.PostOwnerId == Guid.Empty)
        {
            _log.LogWarning("WS-07-SOCIAL-FIX: PostLikedIntegrationEvent has empty PostOwnerId. Skipping notification to avoid targeting zero GUID.");
            return;
        }
        if (m.PostOwnerId == m.LikerUserId)
        {
            _log.LogInformation("WS-07-SOCIAL-FIX: User liked their own post. Skipping notification. UserId={UserId}, PostId={PostId}", m.LikerUserId, m.PostId);
            return;
        }

        var notification = new Notification
        {
            UserId = m.PostOwnerId,
            Type = NotificationType.PostLiked,
            Content = new()
            {
                Title = "Yeni beğeni",
                Body = string.IsNullOrWhiteSpace(m.LikerUserName) ? "Gönderin beğenildi" : $"{m.LikerUserName} gönderini beğendi.",
                DeepLink = $"post:{m.PostId}"
            },
            CreatedAtUtc = m.OccurredAtUtc == default ? DateTime.UtcNow : m.OccurredAtUtc
        };

        await _notifRepo.InsertAsync(notification, context.CancellationToken);
        var tokens = await _tokenRepo.GetByUserIdsAsync(new[] { m.PostOwnerId }, context.CancellationToken);
        await _push.SendAsync(tokens, notification.Content.Title, notification.Content.Body, notification.Content.DeepLink, context.CancellationToken);
        _log.LogInformation("WS-07-SOCIAL-FIX: Created notification Type={Type} for UserId={UserId}, PostId={PostId}, LikerId={LikerId}", notification.Type, notification.UserId, m.PostId, m.LikerUserId);
    }
}

public class PostCommentAddedNotificationConsumer : IConsumer<PostCommentAddedIntegrationEvent>
{
    private readonly INotificationRepository _notifRepo;
    private readonly IDeviceTokenRepository _tokenRepo;
    private readonly IPushSender _push;
    private readonly ILogger<PostCommentAddedNotificationConsumer> _log;

    public PostCommentAddedNotificationConsumer(INotificationRepository notifRepo, IDeviceTokenRepository tokenRepo, IPushSender push, ILogger<PostCommentAddedNotificationConsumer> log)
    {
        _notifRepo = notifRepo; _tokenRepo = tokenRepo; _push = push; _log = log;
    }

    public async Task Consume(ConsumeContext<PostCommentAddedIntegrationEvent> context)
    {
        var m = context.Message;
        _log.LogInformation("WS-07-SOCIAL-FIX: MT consume comment.created PostId={PostId}, Owner={Owner}, Author={Author}", m.PostId, m.PostOwnerId, m.CommentAuthorId);

        if (m.PostOwnerId == Guid.Empty)
        {
            _log.LogWarning("WS-07-SOCIAL-FIX: PostCommentAddedIntegrationEvent has empty PostOwnerId. Skipping notification to avoid targeting zero GUID.");
            return;
        }
        if (m.PostOwnerId == m.CommentAuthorId)
        {
            _log.LogInformation("WS-07-SOCIAL-FIX: User commented on their own post. Skipping notification. UserId={UserId}, PostId={PostId}", m.CommentAuthorId, m.PostId);
            return;
        }

        var text = m.CommentText ?? string.Empty;
        var trimmed = text.Length > 50 ? text[..50] + "..." : text;
        var notification = new Notification
        {
            UserId = m.PostOwnerId,
            Type = NotificationType.CommentCreated,
            Content = new()
            {
                Title = "Yeni yorum",
                Body = string.IsNullOrWhiteSpace(m.CommentAuthorName) ? trimmed : $"{m.CommentAuthorName}: {trimmed}",
                DeepLink = $"post:{m.PostId}"
            },
            CreatedAtUtc = m.OccurredAtUtc == default ? DateTime.UtcNow : m.OccurredAtUtc
        };

        await _notifRepo.InsertAsync(notification, context.CancellationToken);
        var tokens = await _tokenRepo.GetByUserIdsAsync(new[] { m.PostOwnerId }, context.CancellationToken);
        await _push.SendAsync(tokens, notification.Content.Title, notification.Content.Body, notification.Content.DeepLink, context.CancellationToken);
        _log.LogInformation("WS-07-SOCIAL-FIX: Created notification Type={Type} for UserId={UserId}, PostId={PostId}, AuthorId={AuthorId}", notification.Type, notification.UserId, m.PostId, m.CommentAuthorId);
    }
}

    public override Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            _log.LogInformation("WS-07A: EventConsumer starting...");
            _log.LogInformation("🔌 Connecting to RabbitMQ: {Host}:{Port} (user: {User})",
                _opt.HostName, _opt.Port, _opt.UserName);

            var factory = new ConnectionFactory
            {
                HostName = _opt.HostName,
                Port = _opt.Port,
                UserName = _opt.UserName,
                Password = _opt.Password,
                AutomaticRecoveryEnabled = true,
                NetworkRecoveryInterval = TimeSpan.FromSeconds(10)
            };

            _conn = factory.CreateConnection();
            _ch = _conn.CreateModel();

            _log.LogInformation("✅ Connected to RabbitMQ successfully");

            _ch.ExchangeDeclare(_opt.Exchange, ExchangeType.Topic, durable: true);
            _log.LogInformation("📢 Exchange declared: {Exchange}", _opt.Exchange);

            _ch.QueueDeclare(_opt.QueueName, durable: true, exclusive: false, autoDelete: false);
            _ch.QueueBind(_opt.QueueName, _opt.Exchange, "post.created");
            _ch.QueueBind(_opt.QueueName, _opt.Exchange, "post.liked");
            _ch.QueueBind(_opt.QueueName, _opt.Exchange, "comment.created");

            _log.LogInformation("WS-07A: Declaring exchange={Exchange}, queue={Queue}, routingKeys=[{Keys}]",
                _opt.Exchange, _opt.QueueName, string.Join(",", new[] {"post.created","post.liked","comment.created"}));
            _log.LogInformation("📬 Queue declared and bound: {Queue}", _opt.QueueName);

            return base.StartAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "❌ Failed to connect to RabbitMQ: {Message}", ex.Message);
            throw;
        }
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var consumer = new EventingBasicConsumer(_ch!);
        _log.LogInformation("WS-07A: Consuming events from queue {Queue}", _opt.QueueName);
        consumer.Received += async (_, ea) =>
        {
            // Create scope for scoped services
            using var scope = _scopeFactory.CreateScope();
            var notifRepo = scope.ServiceProvider.GetRequiredService<INotificationRepository>();
            var tokenRepo = scope.ServiceProvider.GetRequiredService<IDeviceTokenRepository>();
            var push = scope.ServiceProvider.GetRequiredService<IPushSender>();
            var db = scope.ServiceProvider.GetRequiredService<IMongoDatabase>();
            
            try
            {
                var json = Encoding.UTF8.GetString(ea.Body.ToArray());
                _log.LogInformation("WS-07A: Received raw event from RabbitMQ: {Payload}", json);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                string? type = null;
                if (root.TryGetProperty("type", out var typeProp))
                    type = typeProp.GetString();
                // Fallback: use routing key when no explicit type in payload
                type ??= ea.RoutingKey;
                _log.LogInformation("WS-07A: Event type discriminator = {Type}", type);

                IEnumerable<Guid> targets;
                if (root.TryGetProperty("targetUserIds", out var arr) && arr.ValueKind == JsonValueKind.Array)
                    targets = arr.EnumerateArray().Select(x => x.GetGuid());
                else
                    targets = new[] { root.GetProperty("authorId").GetGuid() };

                // Handle post.created separately for proximity notifications
                if (type == "post.created")
                {
                    await HandlePostCreatedAsync(root, notifRepo, tokenRepo, push, db, stoppingToken);
                    _ch!.BasicAck(ea.DeliveryTag, multiple: false);
                    return;
                }
                
                // Handle post.liked and comment.created events for WS-07A
                if (type == "post.liked")
                {
                    await HandlePostLikedAsync(root, notifRepo, tokenRepo, push, stoppingToken);
                    _ch!.BasicAck(ea.DeliveryTag, multiple: false);
                    return;
                }
                
                if (type == "comment.created")
                {
                    await HandleCommentCreatedAsync(root, notifRepo, tokenRepo, push, stoppingToken);
                    _ch!.BasicAck(ea.DeliveryTag, multiple: false);
                    return;
                }
                
                // Fallback for other event types
                (string title, string body, NotificationType ntype, string? deep) payload = type switch
                {
                    _ => ("Bildirim", "Etkinlik gerçekleşti", NotificationType.PostCreated, null)
                };

                var tokList = await tokenRepo.GetByUserIdsAsync(targets, stoppingToken);
                foreach (var uid in targets)
                {
                    var n = new Notification {
                        UserId = uid,
                        Type = payload.ntype,
                        Content = new() { Title = payload.title, Body = payload.body, DeepLink = payload.deep }
                    };
                    await notifRepo.InsertAsync(n, stoppingToken);
                }
                await push.SendAsync(tokList, payload.title, payload.body, payload.deep, stoppingToken);

                _ch!.BasicAck(ea.DeliveryTag, multiple: false);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Event handling failed");
                _ch!.BasicNack(ea.DeliveryTag, multiple:false, requeue:false);
            }
        };

        _ch!.BasicConsume(_opt.QueueName, autoAck: false, consumer);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Handle post.created event with proximity-based notifications
    /// </summary>
    private async Task HandlePostCreatedAsync(
        JsonElement root, 
        INotificationRepository notifRepo,
        IDeviceTokenRepository tokenRepo,
        IPushSender push,
        IMongoDatabase db,
        CancellationToken ct)
    {
        try
        {
            var postId = root.GetProperty("postId").GetString();
            var authorId = root.GetProperty("authorId").GetGuid();
            
            // Extract location if available
            if (!root.TryGetProperty("latitude", out var latProp) || 
                !root.TryGetProperty("longitude", out var lonProp))
            {
                _log.LogInformation("Post {PostId} has no location, skipping proximity notifications", postId);
                return;
            }
            
            var lat = latProp.GetDouble();
            var lon = lonProp.GetDouble();
            var createdAt = root.GetProperty("createdAt").GetDateTime();
            
            // Only send proximity notifications for fresh posts (within 10 minutes)
            var ageMinutes = (DateTime.UtcNow - createdAt).TotalMinutes;
            if (ageMinutes > 10)
            {
                _log.LogInformation("Post {PostId} is {Age} minutes old, skipping proximity notifications", 
                    postId, ageMinutes);
                return;
            }
            
            _log.LogInformation("📍 Processing proximity notifications for post {PostId} at ({Lat}, {Lon})", 
                postId, lat, lon);
            
            // Find nearby users (within 1km)
            var nearbyUsers = await FindNearbyUsersAsync(db, lat, lon, radiusMeters: 1000, ct);
            
            // Filter out author and apply debounce (max 1 notification per 10 minutes)
            var eligibleUsers = nearbyUsers
                .Where(u => u.UserId != authorId)
                .Where(u => !u.LastNotificationSentAtUtc.HasValue || 
                           (DateTime.UtcNow - u.LastNotificationSentAtUtc.Value).TotalMinutes >= 10)
                .ToList();
            
            if (!eligibleUsers.Any())
            {
                _log.LogInformation("No eligible users for proximity notification (post {PostId})", postId);
                return;
            }
            
            _log.LogInformation("📢 Sending proximity notifications to {Count} users for post {PostId}", 
                eligibleUsers.Count, postId);
            
            var userIds = eligibleUsers.Select(u => u.UserId).ToList();
            var tokens = await tokenRepo.GetByUserIdsAsync(userIds, ct);
            
            // Create notifications
            foreach (var userId in userIds)
            {
                var notification = new Notification
                {
                    UserId = userId,
                    Type = NotificationType.PostCreated,
                    Content = new()
                    {
                        Title = "Yakınınızda yeni paylaşım",
                        Body = "Yakınınızda yeni bir gönderi paylaşıldı",
                        DeepLink = $"blinkr://post/{postId}"
                    }
                };
                await notifRepo.InsertAsync(notification, ct);
            }
            
            // Send push notifications
            await push.SendAsync(
                tokens, 
                "Yakınınızda yeni paylaşım", 
                "Yakınınızda yeni bir gönderi paylaşıldı",
                $"blinkr://post/{postId}",
                ct);
            
            // Update last notification timestamp for debouncing
            await UpdateLastNotificationTimestampAsync(db, userIds, ct);
            
            _log.LogInformation("✅ Sent {Count} proximity notifications for post {PostId}", 
                eligibleUsers.Count, postId);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to handle post.created proximity notifications");
        }
    }
    
    /// <summary>
    /// Find users within radius of a location
    /// </summary>
    private async Task<List<UserLocation>> FindNearbyUsersAsync(
        IMongoDatabase db,
        double lat, double lon, int radiusMeters, CancellationToken ct)
    {
        var collection = db.GetCollection<UserLocation>("user_locations");
        
        var point = new GeoJsonPoint<GeoJson2DGeographicCoordinates>(
            new GeoJson2DGeographicCoordinates(lon, lat));
        
        var filter = Builders<UserLocation>.Filter.Near(
            x => x.Location,
            point,
            maxDistance: radiusMeters);
        
        return await collection.Find(filter).ToListAsync(ct);
    }
    
    /// <summary>
    /// Update last notification timestamp for debouncing
    /// </summary>
    private async Task UpdateLastNotificationTimestampAsync(IMongoDatabase db, List<Guid> userIds, CancellationToken ct)
    {
        var collection = db.GetCollection<UserLocation>("user_locations");
        
        var filter = Builders<UserLocation>.Filter.In(x => x.UserId, userIds);
        var update = Builders<UserLocation>.Update.Set(x => x.LastNotificationSentAtUtc, DateTime.UtcNow);
        
        await collection.UpdateManyAsync(filter, update, cancellationToken: ct);
    }

    /// <summary>
    /// WS-07A: Handle post.liked events to create notifications for post owners
    /// </summary>
    private async Task HandlePostLikedAsync(
        JsonElement root, 
        INotificationRepository notifRepo, 
        IDeviceTokenRepository tokenRepo, 
        IPushSender push, 
        CancellationToken ct)
    {
        try
        {
            var postId = root.GetProperty("postId").GetGuid();
            var likerUserId = root.GetProperty("userId").GetGuid(); // Current event format
            
            _log.LogInformation("👍 WS-07A: Processing post.liked - PostId={PostId}, LikerUserId={LikerUserId}", 
                postId, likerUserId);
            
            // TODO: Get post owner info from BlogService
            // For now, we'll need to enhance the event with PostOwnerId
            // Temporary solution: Skip if we can't determine post owner
            if (!root.TryGetProperty("postOwnerId", out var postOwnerElement))
            {
                _log.LogWarning("⚠️ WS-07A: post.liked event missing postOwnerId - skipping notification");
                return;
            }
            
            var postOwnerId = postOwnerElement.GetGuid();
            
            // Don't notify if user liked their own post
            if (postOwnerId == likerUserId)
            {
                _log.LogDebug("🙅 WS-07A: User liked their own post - skipping notification");
                return;
            }
            
            var likerUserName = root.TryGetProperty("likerUserName", out var nameElement) 
                ? nameElement.GetString() ?? "Bilinmeyen kullanıcı"
                : "Bilinmeyen kullanıcı";
            
            // Create notification
            var notification = new Notification
            {
                UserId = postOwnerId,
                Type = NotificationType.PostLiked,
                Content = new()
                {
                    Title = "Yeni beğeni",
                    Body = $"{likerUserName} gönderini beğendi.",
                    DeepLink = $"post:{postId}"
                },
                CreatedAtUtc = DateTime.UtcNow
            };
            
            await notifRepo.InsertAsync(notification, ct);
            
            // Send push notification
            var tokens = await tokenRepo.GetByUserIdsAsync(new[] { postOwnerId }, ct);
            await push.SendAsync(tokens, notification.Content.Title, notification.Content.Body, 
                notification.Content.DeepLink, ct);
            
            _log.LogInformation("✅ WS-07A: Post liked notification created for UserId={PostOwnerId}", postOwnerId);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "❌ WS-07A: Error handling post.liked event");
            throw;
        }
    }
    
    /// <summary>
    /// WS-07A: Handle comment.created events to create notifications for post owners
    /// </summary>
    private async Task HandleCommentCreatedAsync(
        JsonElement root, 
        INotificationRepository notifRepo, 
        IDeviceTokenRepository tokenRepo, 
        IPushSender push, 
        CancellationToken ct)
    {
        try
        {
            var postId = root.GetProperty("postId").GetGuid();
            var commentAuthorId = root.GetProperty("authorId").GetGuid(); // Current event format
            var commentText = root.GetProperty("commentText").GetString() ?? "";
            
            _log.LogInformation("💬 WS-07A: Processing comment.created - PostId={PostId}, AuthorId={AuthorId}", 
                postId, commentAuthorId);
            
            // TODO: Get post owner info from BlogService
            // For now, we'll need to enhance the event with PostOwnerId
            // Temporary solution: Skip if we can't determine post owner
            if (!root.TryGetProperty("postOwnerId", out var postOwnerElement))
            {
                _log.LogWarning("⚠️ WS-07A: comment.created event missing postOwnerId - skipping notification");
                return;
            }
            
            var postOwnerId = postOwnerElement.GetGuid();
            
            // Don't notify if user commented on their own post
            if (postOwnerId == commentAuthorId)
            {
                _log.LogDebug("🙅 WS-07A: User commented on their own post - skipping notification");
                return;
            }
            
            var commentAuthorName = root.TryGetProperty("commentAuthorName", out var nameElement) 
                ? nameElement.GetString() ?? "Bilinmeyen kullanıcı"
                : "Bilinmeyen kullanıcı";
            
            // Trim comment text for notification
            var trimmedText = commentText.Length > 50 
                ? commentText.Substring(0, 50) + "..."
                : commentText;
            
            // Create notification
            var notification = new Notification
            {
                UserId = postOwnerId,
                Type = NotificationType.CommentCreated,
                Content = new()
                {
                    Title = "Yeni yorum",
                    Body = $"{commentAuthorName}: {trimmedText}",
                    DeepLink = $"post:{postId}"
                },
                CreatedAtUtc = DateTime.UtcNow
            };
            
            await notifRepo.InsertAsync(notification, ct);
            
            // Send push notification
            var tokens = await tokenRepo.GetByUserIdsAsync(new[] { postOwnerId }, ct);
            await push.SendAsync(tokens, notification.Content.Title, notification.Content.Body, 
                notification.Content.DeepLink, ct);
            
            _log.LogInformation("✅ WS-07A: Comment created notification sent to UserId={PostOwnerId}", postOwnerId);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "❌ WS-07A: Error handling comment.created event");
            throw;
        }
    }

    public override void Dispose()
    {
        _ch?.Dispose();
        _conn?.Dispose();
        base.Dispose();
    }
}