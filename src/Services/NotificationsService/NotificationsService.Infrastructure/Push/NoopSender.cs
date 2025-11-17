using Microsoft.Extensions.Logging;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Infrastructure.Push;

public class NoopSender : IPushSender
{
    private readonly ILogger<NoopSender> _log;
    public NoopSender(ILogger<NoopSender> log) => _log = log;

    public Task SendAsync(IEnumerable<DeviceToken> tokens, string title, string body, string? deepLink, CancellationToken ct)
    {
        _log.LogInformation("NOOP push: {Count} tokens, {Title}", tokens.Count(), title);
        return Task.CompletedTask;
    }
}