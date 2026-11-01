using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IdentityService.Api.Moderation;

public record ResolveRequest(string? TargetType, string? TargetId, string? Action, string? Note);
public record ReportQueueRow(
    string TargetType, string TargetId, int Reports, double Score, bool Priority, Dictionary<string, int> Reasons,
    List<string?> Notes, DateTime FirstReportedAtUtc, DateTime LastReportedAtUtc, string? SignalState);

/// <summary>
/// Moderator endpoints (sinyal-mvp-plan Faz 10 P10.4, 11 §4 "Admin"): the open report queue grouped by target, decisions
/// on a signal (dismiss/hide/restore/remove) or a person (dismiss/warn/restrict_24h/suspend_7d/ban), and the audit trail.
/// Only the Admin role; everyone else gets 403. The CLI in scripts/moderation.ps1 drives these.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = AdminPolicy)]
public class AdminModerationController : ControllerBase
{
    public const string AdminPolicy = "moderation.admin";

    private readonly AppDbContext _db;
    private readonly ModerationService _moderation;

    public AdminModerationController(AppDbContext db, ModerationService moderation)
    {
        _db = db;
        _moderation = moderation;
    }

    /// <summary>GET /api/admin/reports - open reports, one row per target: self-harm first, then by weighted score.</summary>
    [HttpGet("reports")]
    public async Task<IActionResult> Reports([FromQuery] int limit = 50, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 200);
        var open = await _db.Reports.Where(r => r.Status == ReportStatus.Open)
            .OrderByDescending(r => r.CreatedAtUtc).Take(2000).ToListAsync(ct);
        var groups = open.GroupBy(r => (r.TargetType, r.TargetId)).ToList();
        var rows = new List<ReportQueueRow>(groups.Count);
        foreach (var g in groups)
        {
            var state = g.Key.TargetType == ReportTargetType.Signal ? await _moderation.SignalStateAsync(g.Key.TargetId, ct) : null;
            rows.Add(new ReportQueueRow(
                g.Key.TargetType == ReportTargetType.Signal ? "signal" : "user",
                g.Key.TargetId,
                g.Count(),
                Math.Round(g.Sum(r => r.Weight), 2),
                g.Any(r => r.Reason == ReportReason.SelfHarm),
                g.GroupBy(r => ReasonName(r.Reason)).ToDictionary(x => x.Key, x => x.Count()),
                g.Where(r => r.Note != null).OrderByDescending(r => r.CreatedAtUtc).Take(5).Select(r => r.Note).ToList(),
                g.Min(r => r.CreatedAtUtc),
                g.Max(r => r.CreatedAtUtc),
                state));
        }
        var ordered = rows.OrderByDescending(r => r.Priority).ThenByDescending(r => r.Score).Take(limit).ToList();
        Response.Headers.CacheControl = "no-store";
        return Ok(new { items = ordered, openReports = open.Count });
    }

    /// <summary>POST /api/admin/reports/resolve - { targetType, targetId, action, note? }; closes the open reports on it.</summary>
    [HttpPost("reports/resolve")]
    public async Task<IActionResult> Resolve([FromBody] ResolveRequest request, CancellationToken ct = default)
    {
        if (!Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var me)) return Unauthorized(new { error = "Unauthorized" });
        var type = (request?.TargetType ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "signal" => (ReportTargetType?)ReportTargetType.Signal,
            "user" => ReportTargetType.User,
            _ => null,
        };
        var targetId = (request?.TargetId ?? string.Empty).Trim();
        if (type is null || targetId.Length == 0 || targetId.Length > SafetyRules.MaxTargetIdLength || string.IsNullOrWhiteSpace(request?.Action))
            return BadRequest(new { error = "INVALID_REQUEST", code = "INVALID_REQUEST" });
        if (type == ReportTargetType.User && Guid.TryParse(targetId, out var target) && target == me)
            return BadRequest(new { error = "SELF", code = "SELF" });

        var result = await _moderation.ResolveAsync(me, type.Value, targetId, request!.Action!, request.Note, ct);
        if (!result.Ok) return StatusCode(result.Status, new { error = result.Error, code = result.Error });
        return Ok(new { resolved = true, action = request.Action!.Trim().ToLowerInvariant() });
    }

    /// <summary>GET /api/admin/actions?targetId= - the audit trail, newest first.</summary>
    [HttpGet("actions")]
    public async Task<IActionResult> Actions([FromQuery] string? targetId = null, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 200);
        var query = _db.ModerationActions.AsQueryable();
        if (!string.IsNullOrWhiteSpace(targetId)) query = query.Where(a => a.TargetId == targetId.Trim());
        var items = await query.OrderByDescending(a => a.CreatedAtUtc).Take(limit)
            .Select(a => new
            {
                a.Id,
                targetType = a.TargetType == ReportTargetType.Signal ? "signal" : "user",
                a.TargetId,
                a.Action,
                a.Note,
                moderatorId = a.ModeratorId == Guid.Empty ? (Guid?)null : a.ModeratorId,
                automatic = a.ModeratorId == Guid.Empty,
                a.CreatedAtUtc,
            }).ToListAsync(ct);
        Response.Headers.CacheControl = "no-store";
        return Ok(new { items });
    }

    private static string ReasonName(ReportReason reason) => reason switch
    {
        ReportReason.Spam => "spam",
        ReportReason.Harassment => "harassment",
        ReportReason.Inappropriate => "inappropriate",
        ReportReason.WrongInfo => "wrong_info",
        ReportReason.Hate => "hate",
        ReportReason.Nudity => "nudity",
        ReportReason.Violence => "violence",
        ReportReason.Privacy => "privacy",
        ReportReason.SelfHarm => "self_harm",
        _ => "other",
    };
}
