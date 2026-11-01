using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IdentityService.Api.Controllers
{
    public record FriendDto(Guid Id, string UserName, string? AvatarKey, DateTime SinceUtc);
    public record FriendRequestDto(Guid Id, string UserName, string? AvatarKey, DateTime CreatedAtUtc);
    public record FriendRequestsDto(IReadOnlyList<FriendRequestDto> Incoming, IReadOnlyList<FriendRequestDto> Outgoing);
    public record SendFriendRequest(Guid UserId);

    /// <summary>How one person relates to another, from the viewer's side. Declined requests read as "none".</summary>
    public static class Relation
    {
        public const string None = "none";
        public const string Self = "self";
        /// <summary>I blocked them (only ever shown to the blocker).</summary>
        public const string Blocked = "blocked";
        public const string Friends = "friends";
        /// <summary>They asked me; I can accept.</summary>
        public const string Incoming = "incoming";
        /// <summary>I asked them; waiting.</summary>
        public const string Outgoing = "outgoing";

        public static string Of(Guid viewer, Guid other, Friendship? row)
        {
            if (viewer == other) return Self;
            if (row is null) return None;
            return row.Status switch
            {
                FriendshipStatus.Accepted => Friends,
                FriendshipStatus.Pending => row.RequesterId == viewer ? Outgoing : Incoming,
                _ => None,
            };
        }
    }

    /// <summary>
    /// Friend requests and the friend list. Friendship is only for finding each other and messaging: it shares no
    /// location, never changes who can see a signal, and other people's friend lists are never exposed.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FriendsController : ControllerBase
    {
        private const int MaxListed = 500;
        private readonly AppDbContext _db;

        public FriendsController(AppDbContext db) => _db = db;

        private bool TryMe(out Guid me) => Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out me);

        private Task<Friendship?> RowAsync(Guid me, Guid other)
        {
            var (a, b) = Friendship.Pair(me, other);
            return _db.Friendships.FirstOrDefaultAsync(f => f.UserAId == a && f.UserBId == b);
        }

        private IActionResult State(Guid me, Guid other, Friendship? row) => Ok(new { userId = other, relation = Relation.Of(me, other, row) });

        /// <summary>GET /api/friends - my friends, newest first.</summary>
        [HttpGet]
        public async Task<IActionResult> List()
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });

            var rows = await _db.Friendships
                .Where(f => f.Status == FriendshipStatus.Accepted && (f.UserAId == me || f.UserBId == me))
                .OrderByDescending(f => f.RespondedAtUtc ?? f.CreatedAtUtc)
                .Take(MaxListed)
                .Select(f => new { OtherId = f.UserAId == me ? f.UserBId : f.UserAId, Since = f.RespondedAtUtc ?? f.CreatedAtUtc })
                .ToListAsync();
            var ids = rows.Select(r => r.OtherId).ToList();
            var users = await _db.Users.Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id);

            return Ok(rows.Where(r => users.ContainsKey(r.OtherId))
                .Select(r => new FriendDto(r.OtherId, users[r.OtherId].UserName, users[r.OtherId].AvatarKey, r.Since)));
        }

        /// <summary>GET /api/friends/requests - who asked me, and whom I asked (still waiting).</summary>
        [HttpGet("requests")]
        public async Task<IActionResult> Requests()
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });

            var pending = await _db.Friendships
                .Where(f => f.Status == FriendshipStatus.Pending && (f.RequesterId == me || f.AddresseeId == me))
                .OrderByDescending(f => f.CreatedAtUtc)
                .Take(MaxListed)
                .Select(f => new { f.RequesterId, f.AddresseeId, f.CreatedAtUtc })
                .ToListAsync();
            var ids = pending.Select(p => p.RequesterId == me ? p.AddresseeId : p.RequesterId).ToList();
            var users = await _db.Users.Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id);

            FriendRequestDto? Dto(Guid otherId, DateTime at) =>
                users.TryGetValue(otherId, out var user) ? new FriendRequestDto(user.Id, user.UserName, user.AvatarKey, at) : null;

            return Ok(new FriendRequestsDto(
                pending.Where(p => p.AddresseeId == me).Select(p => Dto(p.RequesterId, p.CreatedAtUtc)).OfType<FriendRequestDto>().ToList(),
                pending.Where(p => p.RequesterId == me).Select(p => Dto(p.AddresseeId, p.CreatedAtUtc)).OfType<FriendRequestDto>().ToList()));
        }

        /// <summary>POST /api/friends/requests - ask someone to be friends. If they already asked me, it accepts.</summary>
        [HttpPost("requests")]
        public async Task<IActionResult> Send([FromBody] SendFriendRequest request)
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });
            if (request is null || request.UserId == Guid.Empty) return BadRequest(new { error = "INVALID_USER", message = "Kişi seçilemedi." });
            if (request.UserId == me) return BadRequest(new { error = "SELF", message = "Kendine arkadaşlık isteği gönderemezsin." });
            if (!await _db.Users.AnyAsync(u => u.Id == request.UserId))
                return NotFound(new { error = "USER_NOT_FOUND", message = "Bu kişi bulunamadı." });

            // A block in either direction closes this door, and the answer never says which way it points.
            if (await BlockQueries.BetweenAsync(_db, me, request.UserId))
                return StatusCode(StatusCodes.Status403Forbidden, new { error = "REQUEST_NOT_ALLOWED", message = "Bu kişiye şu an istek gönderemezsin." });

            var now = DateTime.UtcNow;
            var row = await RowAsync(me, request.UserId);

            if (row is null)
            {
                var waiting = await _db.Friendships.CountAsync(f => f.RequesterId == me && f.Status == FriendshipStatus.Pending);
                if (waiting >= FriendshipRules.MaxOutgoingPending)
                    return StatusCode(StatusCodes.Status429TooManyRequests, new { error = "TOO_MANY_REQUESTS", message = "Bekleyen çok fazla isteğin var. Biraz sonra tekrar dene." });

                var (a, b) = Friendship.Pair(me, request.UserId);
                row = new Friendship { RequesterId = me, AddresseeId = request.UserId, UserAId = a, UserBId = b, CreatedAtUtc = now };
                _db.Friendships.Add(row);
            }
            else if (row.Status == FriendshipStatus.Accepted)
            {
                return State(me, request.UserId, row); // already friends: nothing to do
            }
            else if (row.Status == FriendshipStatus.Pending)
            {
                if (row.RequesterId == me) return State(me, request.UserId, row); // already asked: idempotent
                row.Status = FriendshipStatus.Accepted; // they asked first: asking back means yes
                row.RespondedAtUtc = now;
            }
            else
            {
                // Declined earlier. The person who declined may always ask; the one who was declined has to wait.
                var beganDeclined = row.AddresseeId == request.UserId && row.RespondedAtUtc is { } at && now - at < FriendshipRules.DeclineCooldown;
                if (beganDeclined)
                    return StatusCode(StatusCodes.Status403Forbidden, new { error = "REQUEST_NOT_ALLOWED", message = "Bu kişiye şu an istek gönderemezsin." });
                row.RequesterId = me;
                row.AddresseeId = request.UserId;
                row.Status = FriendshipStatus.Pending;
                row.CreatedAtUtc = now;
                row.RespondedAtUtc = null;
            }

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Two requests for the same pair raced; whichever won is the truth.
                _db.ChangeTracker.Clear();
                return State(me, request.UserId, await RowAsync(me, request.UserId));
            }
            return State(me, request.UserId, row);
        }

        /// <summary>POST /api/friends/requests/{userId}/accept</summary>
        [HttpPost("requests/{userId:guid}/accept")]
        public async Task<IActionResult> Accept(Guid userId)
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });
            var row = await RowAsync(me, userId);
            if (row is null || row.Status != FriendshipStatus.Pending || row.AddresseeId != me)
                return NotFound(new { error = "REQUEST_NOT_FOUND", message = "Bu istek artık yok." });

            row.Status = FriendshipStatus.Accepted;
            row.RespondedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return State(me, userId, row);
        }

        /// <summary>POST /api/friends/requests/{userId}/decline - the sender is not told; they only see the request stay quiet.</summary>
        [HttpPost("requests/{userId:guid}/decline")]
        public async Task<IActionResult> Decline(Guid userId)
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });
            var row = await RowAsync(me, userId);
            if (row is null || row.Status != FriendshipStatus.Pending || row.AddresseeId != me)
                return NotFound(new { error = "REQUEST_NOT_FOUND", message = "Bu istek artık yok." });

            row.Status = FriendshipStatus.Declined;
            row.RespondedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return State(me, userId, row);
        }

        /// <summary>DELETE /api/friends/requests/{userId} - take back a request I sent.</summary>
        [HttpDelete("requests/{userId:guid}")]
        public async Task<IActionResult> Cancel(Guid userId)
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });
            var row = await RowAsync(me, userId);
            if (row is null || row.Status != FriendshipStatus.Pending || row.RequesterId != me)
                return NotFound(new { error = "REQUEST_NOT_FOUND", message = "Bu istek artık yok." });

            _db.Friendships.Remove(row);
            await _db.SaveChangesAsync();
            return State(me, userId, null);
        }

        /// <summary>DELETE /api/friends/{userId} - end a friendship (either side may).</summary>
        [HttpDelete("{userId:guid}")]
        public async Task<IActionResult> Remove(Guid userId)
        {
            if (!TryMe(out var me)) return Unauthorized(new { error = "Unauthorized" });
            var row = await RowAsync(me, userId);
            if (row is null || row.Status != FriendshipStatus.Accepted)
                return NotFound(new { error = "NOT_FRIENDS", message = "Bu kişi arkadaş listende değil." });

            _db.Friendships.Remove(row);
            await _db.SaveChangesAsync();
            return State(me, userId, null);
        }
    }
}
