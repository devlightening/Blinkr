using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Shared.Events.Events.Identity;

namespace IdentityService.Api.Moderation;

public record ModerationResult(bool Ok, string? Error = null, int Status = 200);

/// <summary>
/// Report handling after a report is saved, and moderator decisions (sinyal-mvp-plan Faz 10 P10.3/P10.4, 11 §4).
/// Reports are owned here; a signal's visibility change is published as <see cref="PostModerationChangedIntegrationEvent"/>
/// for the read model and live place state. Every decision is written to <see cref="ModerationAction"/> (audit trail),
/// and only after its event was published, so a failed publish is retried by the next report or the moderator.
/// </summary>
public sealed class ModerationService
{
    public static readonly string[] SignalActions = { "dismiss", "hide", "restore", "remove" };
    public static readonly string[] UserActions = { "dismiss", Sanctions.Warn, Sanctions.Restrict24h, Sanctions.Suspend7d, Sanctions.Ban };

    private readonly AppDbContext _db;
    private readonly IPublishEndpoint _bus;
    private readonly ILogger<ModerationService> _logger;

    public ModerationService(AppDbContext db, IPublishEndpoint bus, ILogger<ModerationService> logger)
    {
        _db = db;
        _bus = bus;
        _logger = logger;
    }

    /// <summary>A reporter's weight: accounts younger than a day count half (a burst of fresh accounts hides less).</summary>
    public async Task<double> ReporterWeightAsync(Guid reporterId, CancellationToken ct = default)
    {
        var createdAt = await _db.Users.Where(u => u.Id == reporterId).Select(u => (DateTime?)u.CreatedAt).FirstOrDefaultAsync(ct);
        if (createdAt is null) return SafetyRules.NewReporterWeight;
        return DateTime.UtcNow - DateTime.SpecifyKind(createdAt.Value, DateTimeKind.Utc) >= SafetyRules.TrustedReporterAge ? 1.0 : SafetyRules.NewReporterWeight;
    }

    /// <summary>Latest visibility decision for a signal: hidden/removed stay so until a moderator restores it.</summary>
    public async Task<string> SignalStateAsync(string postId, CancellationToken ct = default)
    {
        var last = await _db.ModerationActions
            .Where(a => a.TargetType == ReportTargetType.Signal && a.TargetId == postId && a.Action != "dismiss")
            .OrderByDescending(a => a.CreatedAtUtc).Select(a => a.Action).FirstOrDefaultAsync(ct);
        return last switch
        {
            "auto_hide" or "hide" => PostModerationChangedIntegrationEvent.Hidden,
            "remove" => PostModerationChangedIntegrationEvent.Removed,
            _ => PostModerationChangedIntegrationEvent.Visible,
        };
    }

    public async Task<double> OpenScoreAsync(ReportTargetType type, string targetId, CancellationToken ct = default) =>
        await _db.Reports.Where(r => r.TargetType == type && r.TargetId == targetId && r.Status == ReportStatus.Open).SumAsync(r => r.Weight, ct);

    /// <summary>After a signal report: hide it once open weighted reports reach <see cref="SafetyRules.AutoHideScore"/>.</summary>
    public async Task AfterSignalReportAsync(string postId, CancellationToken ct = default)
    {
        if (!Guid.TryParse(postId, out var id)) return;
        if (await OpenScoreAsync(ReportTargetType.Signal, postId, ct) < SafetyRules.AutoHideScore) return;
        if (await SignalStateAsync(postId, ct) != PostModerationChangedIntegrationEvent.Visible) return;
        if (!await PublishAsync(new PostModerationChangedIntegrationEvent { PostId = id, State = PostModerationChangedIntegrationEvent.Hidden, Action = "auto_hide", OccurredAtUtc = DateTime.UtcNow }, ct))
            return;
        _db.ModerationActions.Add(new ModerationAction { ModeratorId = Guid.Empty, TargetType = ReportTargetType.Signal, TargetId = postId, Action = "auto_hide" });
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Moderation: signal auto-hidden after reports (PostId={PostId})", id);
    }

    /// <summary>A moderator's decision on a reported (or any) signal or person. Closes the open reports on it.</summary>
    public async Task<ModerationResult> ResolveAsync(Guid moderatorId, ReportTargetType type, string targetId, string action, string? note, CancellationToken ct = default)
    {
        action = action.Trim().ToLowerInvariant();
        var allowed = type == ReportTargetType.Signal ? SignalActions : UserActions;
        if (!allowed.Contains(action)) return new ModerationResult(false, "INVALID_ACTION", 400);
        if (note is { Length: > SafetyRules.MaxModerationNoteLength }) return new ModerationResult(false, "NOTE_TOO_LONG", 400);
        var now = DateTime.UtcNow;

        if (type == ReportTargetType.Signal && action != "dismiss")
        {
            if (!Guid.TryParse(targetId, out var postId)) return new ModerationResult(false, "INVALID_TARGET", 400);
            var state = action switch
            {
                "hide" => PostModerationChangedIntegrationEvent.Hidden,
                "remove" => PostModerationChangedIntegrationEvent.Removed,
                _ => PostModerationChangedIntegrationEvent.Visible,
            };
            if (!await PublishAsync(new PostModerationChangedIntegrationEvent { PostId = postId, State = state, Action = action, OccurredAtUtc = now }, ct))
                return new ModerationResult(false, "MODERATION_UNAVAILABLE", 503);
        }
        else if (type == ReportTargetType.User && Sanctions.IsUserAction(action))
        {
            if (!Guid.TryParse(targetId, out var userId)) return new ModerationResult(false, "INVALID_TARGET", 400);
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (user is null) return new ModerationResult(false, "USER_NOT_FOUND", 404);
            DateTime? until = action switch
            {
                Sanctions.Restrict24h => now.AddHours(24),
                Sanctions.Suspend7d => now.AddDays(7),
                Sanctions.Ban => Sanctions.Forever,
                _ => null,
            };
            if (action == Sanctions.Restrict24h) user.RestrictedUntilUtc = Later(user.RestrictedUntilUtc, until);
            if (action is Sanctions.Suspend7d or Sanctions.Ban)
            {
                user.SuspendedUntilUtc = Later(user.SuspendedUntilUtc, until);
                // A suspended person's sessions end: refresh tokens are revoked, the access token runs out within the hour.
                await _db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAtUtc == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAtUtc, now), ct);
            }
            await _db.SaveChangesAsync(ct);
            // The notice is a courtesy: a failed publish does not undo the sanction.
            await PublishAsync(new UserSanctionedIntegrationEvent { UserId = userId, Action = action, UntilUtc = action == Sanctions.Ban ? null : until, OccurredAtUtc = now }, ct);
        }

        var open = await _db.Reports.Where(r => r.TargetType == type && r.TargetId == targetId && r.Status == ReportStatus.Open).ToListAsync(ct);
        foreach (var r in open) { r.Status = ReportStatus.Resolved; r.ResolvedAtUtc = now; }
        _db.ModerationActions.Add(new ModerationAction { ModeratorId = moderatorId, TargetType = type, TargetId = targetId, Action = action, Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim() });
        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Moderation: {Action} on {TargetType} by moderator {ModeratorId}, {Closed} report(s) closed", action, type, moderatorId, open.Count);
        return new ModerationResult(true);
    }

    private static DateTime? Later(DateTime? current, DateTime? next) =>
        current is null || (next is not null && next > current) ? next : current;

    private async Task<bool> PublishAsync<T>(T message, CancellationToken ct) where T : class
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(3));
            await _bus.Publish(message, cts.Token);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Moderation event could not be published ({Event})", typeof(T).Name);
            return false;
        }
    }
}
