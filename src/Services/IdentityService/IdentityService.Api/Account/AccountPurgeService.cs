using IdentityService.Infrastructure.Data;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Shared.Events.Events.Identity;

namespace IdentityService.Api.Account;

/// <summary>
/// Erases accounts whose 30-day deletion grace is over (plan-devam F3, P10.7). For each one it first tells every other
/// service (<see cref="UserDeletedIntegrationEvent"/>) and only then erases the identity data: friendships, blocks,
/// follows, saved places, reports the person filed, data requests and sessions. The user row stays, emptied of
/// anything personal, so moderation records still resolve. If publishing fails, nothing is erased and the next sweep
/// tries again (consumers are idempotent). Never throws: a failing sweep must not stop the host.
/// </summary>
public sealed class AccountPurgeService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<AccountPurgeService> _logger;
    private readonly TimeSpan _interval;

    public AccountPurgeService(IServiceScopeFactory scopes, IConfiguration config, ILogger<AccountPurgeService> logger)
    {
        _scopes = scopes;
        _logger = logger;
        _interval = TimeSpan.FromSeconds(Math.Max(5, config.GetValue<int?>("AccountDeletion:SweepSeconds") ?? 3600));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await SweepAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { _logger.LogError(ex, "Account purge sweep failed"); }
            try { await Task.Delay(_interval, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var bus = scope.ServiceProvider.GetRequiredService<IPublishEndpoint>();
        var now = DateTime.UtcNow;
        var due = await db.Users.Where(u => u.DeletedAtUtc == null && u.DeletionScheduledForUtc != null && u.DeletionScheduledForUtc <= now)
            .OrderBy(u => u.DeletionScheduledForUtc).Take(20).ToListAsync(ct);

        foreach (var user in due)
        {
            try
            {
                using var publishTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                publishTimeout.CancelAfter(TimeSpan.FromSeconds(10));
                await bus.Publish(new UserDeletedIntegrationEvent { UserId = user.Id, DeletedAtUtc = now }, publishTimeout.Token);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Account purge could not announce the deletion; will retry | UserId={UserId}", user.Id);
                continue;
            }

            var id = user.Id;
            db.Friendships.RemoveRange(db.Friendships.Where(f => f.UserAId == id || f.UserBId == id));
            db.UserBlocks.RemoveRange(db.UserBlocks.Where(b => b.BlockerId == id || b.BlockedId == id));
            db.Follows.RemoveRange(db.Follows.Where(f => f.FollowerId == id || f.FolloweeId == id));
            db.SavedPlaces.RemoveRange(db.SavedPlaces.Where(s => s.UserId == id));
            db.Reports.RemoveRange(db.Reports.Where(r => r.ReporterId == id));
            db.DataRequests.RemoveRange(db.DataRequests.Where(r => r.UserId == id));
            db.RefreshTokens.RemoveRange(db.RefreshTokens.Where(t => t.UserId == id));

            // Nothing personal stays: a placeholder name nobody searches for, an address that cannot receive mail,
            // a password nobody knows.
            var tag = id.ToString("N")[..12];
            user.UserName = $"silinmis_{tag}";
            user.Email = $"{tag}@deleted.invalid";
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"));
            user.AvatarKey = null;
            user.Bio = null;
            user.BirthYear = null;
            user.IsPrivate = true;
            user.DeletedAtUtc = now;
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Account erased | UserId={UserId}", id);
        }
    }
}
