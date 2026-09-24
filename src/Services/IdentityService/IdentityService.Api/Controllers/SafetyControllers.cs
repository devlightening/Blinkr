using IdentityService.Api.Moderation;
using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace IdentityService.Api.Controllers
{
    public record BlockedUserDto(Guid Id, string UserName, string? AvatarKey, DateTime BlockedAtUtc);
    public record BlockRequest(Guid UserId);
    public record ReportRequest(string? TargetType, string? TargetId, string? Reason, string? Note);

    /// <summary>Who is off limits to whom. Used by search, friend requests, profiles and (through a forwarded token) chat.</summary>
    public static class BlockQueries
    {
        /// <summary>True when a block exists between the two people in either direction.</summary>
        public static Task<bool> BetweenAsync(AppDbContext db, Guid a, Guid b) =>
            db.UserBlocks.AnyAsync(x => (x.BlockerId == a && x.BlockedId == b) || (x.BlockerId == b && x.BlockedId == a));

        /// <summary>Everyone the viewer must not see or be seen by: people they blocked and people who blocked them.</summary>
        public static async Task<HashSet<Guid>> HiddenFromAsync(AppDbContext db, Guid me)
        {
            if (me == Guid.Empty) return new HashSet<Guid>();
            var rows = await db.UserBlocks.Where(x => x.BlockerId == me || x.BlockedId == me)
                .Select(x => new { x.BlockerId, x.BlockedId }).ToListAsync();
            return rows.Select(x => x.BlockerId == me ? x.BlockedId : x.BlockerId).ToHashSet();
        }
    }

    /// <summary>
    /// Block and unblock people. Blocking ends any friendship at once. The blocked person is never told; they simply can no
    /// longer find, add or message the blocker.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BlocksController : ControllerBase
    {
        private readonly AppDbContext _db;
        public BlocksController(AppDbContext db) => _db = db;

        private bool TryMe(out Guid me) => Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out me);

        /// <summary>GET /api/blocks - people I blocked (newest first).</summary>
        [HttpGet]
        public async Task<IActionResult> List()
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });
            var rows = await _db.UserBlocks.Where(b => b.BlockerId == me).OrderByDescending(b => b.CreatedAtUtc)
                .Take(SafetyRules.MaxBlocks).Select(b => new { b.BlockedId, b.CreatedAtUtc }).ToListAsync();
            var ids = rows.Select(r => r.BlockedId).ToList();
            var users = await _db.Users.Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id);
            return Ok(rows.Where(r => users.ContainsKey(r.BlockedId))
                .Select(r => new BlockedUserDto(r.BlockedId, users[r.BlockedId].UserName, users[r.BlockedId].AvatarKey, r.CreatedAtUtc)));
        }

        /// <summary>GET /api/blocks/status/{userId} - is there a block between me and them, in either direction? (chat asks this.)</summary>
        [HttpGet("status/{userId:guid}")]
        public async Task<IActionResult> Status(Guid userId)
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });
            var blocked = await BlockQueries.BetweenAsync(_db, me, userId);
            // plan-devam F5: when either person is under 18 only friends can message each other. A deleted account
            // cannot be messaged at all.
            var people = await _db.Users.Where(u => u.Id == me || u.Id == userId).Select(u => new { u.Id, u.BirthYear, u.DeletedAtUtc }).ToListAsync();
            var gone = people.Any(p => p.Id == userId && p.DeletedAtUtc != null);
            var minor = people.Any(p => AgeRules.IsMinor(p.BirthYear));
            var friends = !minor || await _db.Friendships.AnyAsync(f => f.Status == FriendshipStatus.Accepted && ((f.UserAId == me && f.UserBId == userId) || (f.UserAId == userId && f.UserBId == me)));
            var reason = blocked ? "blocked" : gone ? "gone" : !friends ? "friends_only" : null;
            return Ok(new { blocked, canMessage = reason is null, reason });
        }

        /// <summary>POST /api/blocks - block someone (idempotent). Ends any friendship or pending request between us.</summary>
        [HttpPost]
        public async Task<IActionResult> Block([FromBody] BlockRequest request)
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });
            if (request is null || request.UserId == Guid.Empty) return BadRequest(new { error = "INVALID_USER", message = "Kişi seçilemedi." });
            if (request.UserId == me) return BadRequest(new { error = "SELF", message = "Kendini engelleyemezsin." });
            if (!await _db.Users.AnyAsync(u => u.Id == request.UserId))
                return NotFound(new { error = "USER_NOT_FOUND", message = "Bu kişi bulunamadı." });

            if (!await _db.UserBlocks.AnyAsync(b => b.BlockerId == me && b.BlockedId == request.UserId))
            {
                if (await _db.UserBlocks.CountAsync(b => b.BlockerId == me) >= SafetyRules.MaxBlocks)
                    return StatusCode(StatusCodes.Status429TooManyRequests, new { error = "TOO_MANY_BLOCKS", message = "Engelleme listen dolu." });

                _db.UserBlocks.Add(new UserBlock { BlockerId = me, BlockedId = request.UserId });
                var (a, b) = Friendship.Pair(me, request.UserId);
                var friendship = await _db.Friendships.FirstOrDefaultAsync(f => f.UserAId == a && f.UserBId == b);
                if (friendship is not null) _db.Friendships.Remove(friendship);
                // Blocking ends following in both directions too (and any waiting follow request).
                var follows = await _db.Follows.Where(f => (f.FollowerId == me && f.FolloweeId == request.UserId) || (f.FollowerId == request.UserId && f.FolloweeId == me)).ToListAsync();
                _db.Follows.RemoveRange(follows);
                try { await _db.SaveChangesAsync(); }
                catch (DbUpdateException) { _db.ChangeTracker.Clear(); /* a parallel block won the race: same outcome */ }
            }
            return Ok(new { userId = request.UserId, relation = Relation.Blocked });
        }

        /// <summary>DELETE /api/blocks/{userId} - unblock. Friendship is not restored.</summary>
        [HttpDelete("{userId:guid}")]
        public async Task<IActionResult> Unblock(Guid userId)
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });
            var row = await _db.UserBlocks.FirstOrDefaultAsync(b => b.BlockerId == me && b.BlockedId == userId);
            if (row is not null)
            {
                _db.UserBlocks.Remove(row);
                await _db.SaveChangesAsync();
            }
            return Ok(new { userId, relation = Relation.None });
        }
    }

    /// <summary>Report a person or a signal. Reports are stored for moderation; the reporter gets a calm acknowledgement.</summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private static readonly Regex SignalId = new(@"^[A-Za-z0-9\-_]{1,64}$", RegexOptions.Compiled);
        private readonly AppDbContext _db;
        private readonly ModerationService _moderation;
        public ReportsController(AppDbContext db, ModerationService moderation)
        {
            _db = db;
            _moderation = moderation;
        }

        private static bool TryReason(string? raw, out ReportReason reason)
        {
            switch ((raw ?? string.Empty).Trim().ToLowerInvariant())
            {
                case "spam": reason = ReportReason.Spam; return true;
                case "harassment": reason = ReportReason.Harassment; return true;
                case "inappropriate": reason = ReportReason.Inappropriate; return true;
                case "wrong_info": reason = ReportReason.WrongInfo; return true;
                case "other": reason = ReportReason.Other; return true;
                case "hate": reason = ReportReason.Hate; return true;
                case "nudity": reason = ReportReason.Nudity; return true;
                case "violence": reason = ReportReason.Violence; return true;
                case "privacy": reason = ReportReason.Privacy; return true;
                case "self_harm": reason = ReportReason.SelfHarm; return true;
                default: reason = default; return false;
            }
        }

        /// <summary>POST /api/reports - { targetType: user|signal, targetId, reason: spam|harassment|hate|nudity|violence|privacy|self_harm|inappropriate|wrong_info|other, note? }</summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ReportRequest request)
        {
            if (!Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var me)) return Unauthorized(new { error = "Unauthorized" });
            if (request is null) return BadRequest(new { error = "INVALID_REPORT", message = "Bildirim okunamadı." });

            var type = (request.TargetType ?? string.Empty).Trim().ToLowerInvariant() switch
            {
                "user" => (ReportTargetType?)ReportTargetType.User,
                "signal" => ReportTargetType.Signal,
                _ => null,
            };
            if (type is null || !TryReason(request.Reason, out var reason))
                return BadRequest(new { error = "INVALID_REPORT", message = "Bildirim türü veya nedeni geçersiz." });

            var targetId = (request.TargetId ?? string.Empty).Trim();
            if (type == ReportTargetType.User)
            {
                if (!Guid.TryParse(targetId, out var targetUser)) return BadRequest(new { error = "INVALID_REPORT", message = "Kişi seçilemedi." });
                if (targetUser == me) return BadRequest(new { error = "SELF", message = "Kendini bildiremezsin." });
                if (!await _db.Users.AnyAsync(u => u.Id == targetUser)) return NotFound(new { error = "USER_NOT_FOUND", message = "Bu kişi bulunamadı." });
                targetId = targetUser.ToString();
            }
            else if (!SignalId.IsMatch(targetId))
            {
                return BadRequest(new { error = "INVALID_REPORT", message = "Sinyal seçilemedi." });
            }

            string? note = null;
            if (!string.IsNullOrWhiteSpace(request.Note))
            {
                note = Regex.Replace(new string(request.Note.Select(c => char.IsControl(c) ? ' ' : c).ToArray()), @"\s+", " ").Trim();
                if (note.Length > SafetyRules.MaxNoteLength) return BadRequest(new { error = "NOTE_TOO_LONG", message = $"Açıklama en fazla {SafetyRules.MaxNoteLength} karakter olabilir." });
            }

            // Reporting the same thing twice is a no-op: the reporter is thanked, the queue is not padded.
            if (await _db.Reports.AnyAsync(r => r.ReporterId == me && r.TargetType == type && r.TargetId == targetId))
                return Ok(new { reported = true });

            var since = DateTime.UtcNow.AddDays(-1);
            if (await _db.Reports.CountAsync(r => r.ReporterId == me && r.CreatedAtUtc >= since) >= SafetyRules.MaxReportsPerDay)
                return StatusCode(StatusCodes.Status429TooManyRequests, new { error = "TOO_MANY_REPORTS", message = "Bugün çok fazla bildirim gönderdin. Yarın tekrar dene." });

            var weight = await _moderation.ReporterWeightAsync(me);
            _db.Reports.Add(new Report { ReporterId = me, TargetType = type.Value, TargetId = targetId, Reason = reason, Note = note, Weight = weight });
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { _db.ChangeTracker.Clear(); return Ok(new { reported = true }); /* duplicate from a race: already reported */ }
            // Enough weighted reports hide a signal until a moderator looks (11 §4). Never fails the report itself.
            if (type == ReportTargetType.Signal)
            {
                try { await _moderation.AfterSignalReportAsync(targetId); }
                catch (Exception) { /* logged inside; the report is saved and the next one retries */ }
            }
            return Ok(new { reported = true });
        }
    }
}
