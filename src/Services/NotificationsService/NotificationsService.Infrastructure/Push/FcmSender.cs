using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

// Domain
using NotificationsService.Domain.Entities;        // DeviceToken için
using NotificationsService.Domain.Interfaces;


// Config alias (senin FcmOptions'ýný iþaret etsin)
using FcmCfg = NotificationsService.Infrastructure.Config.FcmOptions;

// Firebase Messaging'i alias'la, kýsa adla kullan
using FcmMsg = FirebaseAdmin.Messaging;

namespace NotificationsService.Infrastructure.Push;


public class FcmSender : IPushSender
{
    private readonly ILogger<FcmSender> _log;
    private readonly FcmMsg.FirebaseMessaging _messaging;

    public FcmSender(ILogger<FcmSender> log, IOptions<FcmCfg> opt)
    {
        _log = log;

        if (FirebaseApp.DefaultInstance is null)
        {
            var path = opt.Value.CredentialsPath
                ?? throw new InvalidOperationException("Fcm:CredentialsPath missing");

            FirebaseApp.Create(new AppOptions
            {
                Credential = GoogleCredential.FromFile(path)
            });
        }

        _messaging = FcmMsg.FirebaseMessaging.DefaultInstance;
    }

    public async Task SendAsync(IEnumerable<DeviceToken> tokens, string title, string body, string? deepLink, CancellationToken ct)
    {
        var messages = tokens.Select(t => new FcmMsg.Message
        {
            Token = t.Token,
            Notification = new FcmMsg.Notification { Title = title, Body = body },
            Data = deepLink is null
                ? new Dictionary<string, string>()
                : new Dictionary<string, string> { ["deepLink"] = deepLink }
        }).ToList();

        // FCM SendAllAsync limit 500; 100 de güvenli (istersen 500 yap)
        foreach (var chunk in messages.Chunk(100))
        {
            var resp = await _messaging.SendAllAsync(chunk, ct);
            _log.LogInformation("FCM sent: success={Success}, failure={Failure}", resp.SuccessCount, resp.FailureCount);
        }
    }
}
