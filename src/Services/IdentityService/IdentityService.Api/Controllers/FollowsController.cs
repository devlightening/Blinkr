using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IdentityService.Api.Controllers
{
    public record FollowUserDto(Guid Id, string UserName, string? AvatarKey, string Follow, bool FollowsYou);
    public record FollowPageDto(IReadOnlyList<FollowUserDto> Items, int Page, int PageSize, int TotalCount, bool HasMore);
    public record FollowRequestItemDto(Guid Id, string UserName, string? AvatarKey, DateTime CreatedAtUtc);
    public record SetPrivacyRequest(bool IsPrivate);

    /// <summary>My follow state towards someone, from my side.</summary>
    public static class FollowState
    {
        public const string None = "none";
        public const string Requested = "requested";
        public const string Following = "following";

        public static string Of(Follow? row) => row is null ? None : row.Status == FollowStatus.Accepted ? Following : Requested;
    }

    public static class FollowQueries
    {
        /// <summary>Whether <paramref name="viewer"/> may see <paramref name="owner"/>'s profile content (grid, lists).</summary>
        public static async Task<bool> CanSeeAsync(AppDbContext db, Guid viewer, Guid owner)
        {
            if (viewer != Guid.Empty && viewer == owner) return true;
            var user = await db.Users.Where(u => u.Id == owner).Select(u => new { u.IsPrivate }).FirstOrDefaultAsync();
            if (user is null) return false;
            if (viewer != Guid.Empty && await BlockQueries.BetweenAsync(db, viewer, owner)) return false;
            if (!user.IsPrivate) return true;
            return viewer != Guid.Empty && await db.Follows.AnyAsync(f => f.FollowerId == viewer && f.FolloweeId == owner && f.Status == FollowStatus.Accepted);
        }

        public static Task<int> FollowersAsync(AppDbContext db, Guid owner) =>
            db.Follows.CountAsync(f => f.FolloweeId == owner && f.Status == FollowStatus.Accepted);

        public static Task<int> FollowingAsync(AppDbContext db, Guid owner) =>
            db.Follows.CountAsync(f => f.FollowerId == owner && f.Status == FollowStatus.Accepted);
    }

    /// <summary>
    /// One-way following (sinyal-mvp-plan Faz 6 P6.1, DECISIONS D-009). Following shares no location and never changes
    /// who sees a signal on the map. A private account approves each follower. Blocks end follows both ways and close
    /// every door here; the answer never says which way a block points.
    /// </summary>
    [ApiController]
    [Authorize]
    public class FollowsController : ControllerBase
    {
        private readonly AppDbContext _db;

        public FollowsController(AppDbContext db) => _db = db;

        private Guid Viewer() => Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : Guid.Empty;

        private Task<Follow?> RowAsync(Guid follower, Guid followee) =>
            _db.Follows.FirstOrDefaultAsync(f => f.FollowerId == follower && f.FolloweeId == followee);

        private IActionResult State(Guid other, Follow? row) => Ok(new { userId = other, follow = FollowState.Of(row) });

        /// <summary>POST /api/follows/{userId} - follow (a private account gets a request instead). Idempotent.</summary>
        [HttpPost("api/follows/{userId:guid}")]
        public async Task<IActionResult> Follow(Guid userId)
        {
            var me = Viewer();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            if (userId == me) return BadRequest(new { error = "SELF", message = "Kendini takip edemezsin." });
            var target = await _db.Users.Where(u => u.Id == userId).Select(u => new { u.IsPrivate }).FirstOrDefaultAsync();
            if (target is null) return NotFound(new { error = "USER_NOT_FOUND", message = "Bu kişi bulunamadı." });
            if (await BlockQueries.BetweenAsync(_db, me, userId))
                return StatusCode(StatusCodes.Status403Forbidden, new { error = "FOLLOW_NOT_ALLOWED", message = "Bu kişiyi şu an takip edemezsin." });

            var existing = await RowAsync(me, userId);
            if (existing is not null) return State(userId, existing);

            if (target.IsPrivate && await _db.Follows.CountAsync(f => f.FollowerId == me && f.Status == FollowStatus.Pending) >= FollowRules.MaxOutgoingPending)
                return StatusCode(StatusCodes.Status429TooManyRequests, new { error = "TOO_MANY_REQUESTS", message = "Bekleyen çok fazla isteğin var. Biraz sonra tekrar dene." });
            if (await _db.Follows.CountAsync(f => f.FollowerId == me) >= FollowRules.MaxFollowing)
                return StatusCode(StatusCodes.Status429TooManyRequests, new { error = "TOO_MANY_FOLLOWS", message = "Takip listen dolu." });

            var now = DateTime.UtcNow;
            var row = new Follow
            {
                FollowerId = me,
                FolloweeId = userId,
                Status = target.IsPrivate ? FollowStatus.Pending : FollowStatus.Accepted,
                CreatedAtUtc = now,
                AcceptedAtUtc = target.IsPrivate ? null : now,
            };
            _db.Follows.Add(row);
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                _db.ChangeTracker.Clear(); // a parallel follow won the race: same outcome
                return State(userId, await RowAsync(me, userId));
            }
            return State(userId, row);
        }

        /// <summary>DELETE /api/follows/{userId} - unfollow, or take back a waiting request.</summary>
        [HttpDelete("api/follows/{userId:guid}")]
        public async Task<IActionResult> Unfollow(Guid userId)
        {
            var me = Viewer();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            var row = await RowAsync(me, userId);
            if (row is not null)
            {
                _db.Follows.Remove(row);
                await _db.SaveChangesAsync();
            }
            return State(userId, null);
        }

        /// <summary>GET /api/follows/requests - people waiting for me to approve them (private account).</summary>
        [HttpGet("api/follows/requests")]
        public async Task<IActionResult> Requests()
        {
            var me = Viewer();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            var hidden = await BlockQueries.HiddenFromAsync(_db, me);
            var rows = await _db.Follows
                .Where(f => f.FolloweeId == me && f.Status == FollowStatus.Pending && !hidden.Contains(f.FollowerId))
                .OrderByDescending(f => f.CreatedAtUtc)
                .Take(200)
                .Join(_db.Users, f => f.FollowerId, u => u.Id, (f, u) => new FollowRequestItemDto(u.Id, u.UserName, u.AvatarKey, f.CreatedAtUtc))
                .ToListAsync();
            return Ok(rows);
        }

        /// <summary>POST /api/follows/requests/{userId}/accept</summary>
        [HttpPost("api/follows/requests/{userId:guid}/accept")]
        public async Task<IActionResult> Accept(Guid userId)
        {
            var me = Viewer();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            var row = await RowAsync(userId, me);
            if (row is null || row.Status != FollowStatus.Pending)
                return NotFound(new { error = "REQUEST_NOT_FOUND", message = "Bu istek artık yok." });
            row.Status = FollowStatus.Accepted;
            row.AcceptedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { userId, follower = true });
        }

        /// <summary>POST /api/follows/requests/{userId}/decline - the request simply goes away; the sender is not told.</summary>
        [HttpPost("api/follows/requests/{userId:guid}/decline")]
        public async Task<IActionResult> Decline(Guid userId)
        {
            var me = Viewer();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            var row = await RowAsync(userId, me);
            if (row is null || row.Status != FollowStatus.Pending)
                return NotFound(new { error = "REQUEST_NOT_FOUND", message = "Bu istek artık yok." });
            _db.Follows.Remove(row);
            await _db.SaveChangesAsync();
            return Ok(new { userId, follower = false });
        }

        /// <summary>DELETE /api/follows/followers/{userId} - remove someone from my followers (they are not told).</summary>
        [HttpDelete("api/follows/followers/{userId:guid}")]
        public async Task<IActionResult> RemoveFollower(Guid userId)
        {
            var me = Viewer();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            var row = await RowAsync(userId, me);
            if (row is not null)
            {
                _db.Follows.Remove(row);
                await _db.SaveChangesAsync();
            }
            return Ok(new { userId, follower = false });
        }

        /// <summary>
        /// GET /api/follows/visibility/{userId} - may the caller see this person's profile content? Used by BlogService
        /// for the author's signal list; answers for a signed-out caller too (public accounts only).
        /// </summary>
        [HttpGet("api/follows/visibility/{userId:guid}")]
        [AllowAnonymous]
        public async Task<IActionResult> Visibility(Guid userId) =>
            Ok(new { userId, canSee = await FollowQueries.CanSeeAsync(_db, Viewer(), userId) });

        /// <summary>PUT /api/users/me/privacy - make my account private or public. Going public approves every waiting request.</summary>
        [HttpPut("api/users/me/privacy")]
        public async Task<IActionResult> SetPrivacy([FromBody] SetPrivacyRequest request)
        {
            var me = Viewer();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == me);
            if (user is null) return NotFound(new { error = "USER_NOT_FOUND" });
            user.IsPrivate = request?.IsPrivate ?? false;
            if (!user.IsPrivate)
            {
                var now = DateTime.UtcNow;
                var waiting = await _db.Follows.Where(f => f.FolloweeId == me && f.Status == FollowStatus.Pending).ToListAsync();
                foreach (var row in waiting) { row.Status = FollowStatus.Accepted; row.AcceptedAtUtc = now; }
            }
            await _db.SaveChangesAsync();
            return Ok(new { isPrivate = user.IsPrivate });
        }

        /// <summary>GET /api/users/{id}/followers?page&amp;pageSize - only when the caller may see this account.</summary>
        [HttpGet("api/users/{id:guid}/followers")]
        public Task<IActionResult> Followers(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 30) => ListAsync(id, page, pageSize, followers: true);

        /// <summary>GET /api/users/{id}/following?page&amp;pageSize - only when the caller may see this account.</summary>
        [HttpGet("api/users/{id:guid}/following")]
        public Task<IActionResult> Following(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 30) => ListAsync(id, page, pageSize, followers: false);

        private async Task<IActionResult> ListAsync(Guid owner, int page, int pageSize, bool followers)
        {
            var me = Viewer();
            if (!await _db.Users.AnyAsync(u => u.Id == owner)) return NotFound(new { error = "USER_NOT_FOUND" });
            if (!await FollowQueries.CanSeeAsync(_db, me, owner))
                return StatusCode(StatusCodes.Status403Forbidden, new { error = "PRIVATE_ACCOUNT", message = "Bu hesap gizli." });

            page = Math.Clamp(page, 1, 1000);
            pageSize = Math.Clamp(pageSize, 1, FollowRules.MaxPageSize);
            var hidden = await BlockQueries.HiddenFromAsync(_db, me);
            var query = _db.Follows.Where(f => f.Status == FollowStatus.Accepted && (followers ? f.FolloweeId == owner : f.FollowerId == owner));
            var ids = followers ? query.Select(f => new { Other = f.FollowerId, f.AcceptedAtUtc, f.CreatedAtUtc }) : query.Select(f => new { Other = f.FolloweeId, f.AcceptedAtUtc, f.CreatedAtUtc });
            var visible = ids.Where(x => !hidden.Contains(x.Other));
            var total = await visible.CountAsync();
            var pageRows = await visible
                .OrderByDescending(x => x.AcceptedAtUtc ?? x.CreatedAtUtc)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Join(_db.Users, x => x.Other, u => u.Id, (x, u) => new { u.Id, u.UserName, u.AvatarKey })
                .ToListAsync();

            var otherIds = pageRows.Select(r => r.Id).ToList();
            var mine = me == Guid.Empty ? new List<Follow>() : await _db.Follows.Where(f => f.FollowerId == me && otherIds.Contains(f.FolloweeId)).ToListAsync();
            var theirs = me == Guid.Empty ? new HashSet<Guid>() : (await _db.Follows.Where(f => f.FolloweeId == me && f.Status == FollowStatus.Accepted && otherIds.Contains(f.FollowerId)).Select(f => f.FollowerId).ToListAsync()).ToHashSet();

            var items = pageRows.Select(r => new FollowUserDto(
                r.Id, r.UserName, r.AvatarKey,
                r.Id == me ? "self" : FollowState.Of(mine.FirstOrDefault(f => f.FolloweeId == r.Id)),
                theirs.Contains(r.Id))).ToList();
            return Ok(new FollowPageDto(items, page, pageSize, total, page * pageSize < total));
        }
    }
}
