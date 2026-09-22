using IdentityService.Application.Interfaces;
using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IdentityService.Api.Controllers
{
    public record UserSummaryDto(Guid Id, string UserName, string? AvatarKey = null, string Relation = "none");
    public record PublicProfileDto(Guid Id, string UserName, string? AvatarKey, string? Bio, DateTime JoinedAtUtc, string Relation);
    public record SetAvatarRequest(string? AvatarKey);
    public record SetProfileRequest(string? Bio);

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly AppDbContext _db;

        public UsersController(IUserService userService, AppDbContext db)
        {
            _userService = userService;
            _db = db;
        }

        /// <summary>
        /// GET /api/users/me - Get current user info
        /// </summary>
        [HttpGet("me")]
        public async Task<IActionResult> GetMe()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized("Invalid token.");
            }

            var user = await _userService.GetUserByIdAsync(userId);
            if (user == null)
            {
                return NotFound("User not found.");
            }

            user.FriendCount = await _db.Friendships.CountAsync(f => f.Status == FriendshipStatus.Accepted && (f.UserAId == userId || f.UserBId == userId));
            user.IncomingRequestCount = await _db.Friendships.CountAsync(f => f.Status == FriendshipStatus.Pending && f.AddresseeId == userId);
            return Ok(user);
        }

        /// <summary>
        /// PUT /api/users/me/profile - the short public line about me (empty clears it).
        /// </summary>
        [HttpPut("me/profile")]
        public async Task<IActionResult> SetProfile([FromBody] SetProfileRequest request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { error = "Unauthorized" });

            var bio = CleanBio(request?.Bio);
            if (bio is not null && bio.Length > FriendshipRules.MaxBioLength)
                return BadRequest(new { error = "BIO_TOO_LONG", message = $"Hakkında en fazla {FriendshipRules.MaxBioLength} karakter olabilir." });

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user is null) return NotFound(new { error = "USER_NOT_FOUND" });

            user.Bio = bio;
            await _db.SaveChangesAsync();
            return Ok(new { bio });
        }

        /// <summary>Trims, collapses line breaks and control characters; empty becomes null.</summary>
        internal static string? CleanBio(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            var cleaned = new string(raw.Select(c => char.IsControl(c) ? ' ' : c).ToArray());
            cleaned = System.Text.RegularExpressions.Regex.Replace(cleaned, @"\s+", " ").Trim();
            return cleaned.Length == 0 ? null : cleaned;
        }

        /// <summary>
        /// GET /api/users/search?q= - Search users by username (chat/DM için kullanıcı arama)
        /// </summary>
        /// <summary>
        /// PUT /api/users/me/avatar - choose an avatar from the fixed catalogue (null clears it back to the default).
        /// </summary>
        [HttpPut("me/avatar")]
        public async Task<IActionResult> SetAvatar([FromBody] SetAvatarRequest request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { error = "Unauthorized" });

            if (!string.IsNullOrEmpty(request.AvatarKey) && !IdentityService.Domain.AvatarCatalog.IsValid(request.AvatarKey))
                return BadRequest(new { error = "INVALID_AVATAR", message = "Bu avatar seçeneği geçerli değil." });

            if (!await _userService.SetAvatarAsync(userId, request.AvatarKey))
                return NotFound(new { error = "USER_NOT_FOUND" });

            return Ok(new { avatarKey = string.IsNullOrEmpty(request.AvatarKey) ? null : request.AvatarKey });
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
                return Ok(Array.Empty<UserSummaryDto>());

            var term = q.Trim();
            var hidden = await BlockQueries.HiddenFromAsync(_db, ViewerId());
            var found = await _db.Users
                .Where(u => !hidden.Contains(u.Id) && EF.Functions.ILike(u.UserName, $"%{term}%"))
                .OrderBy(u => u.UserName)
                .Take(20)
                .Select(u => new { u.Id, u.UserName, u.AvatarKey })
                .ToListAsync();

            var me = ViewerId();
            var rows = await RowsAsync(me, found.Select(u => u.Id).ToList());
            return Ok(found.Select(u => new UserSummaryDto(u.Id, u.UserName, u.AvatarKey, Relation.Of(me, u.Id, rows.GetValueOrDefault(u.Id)))));
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var user = await _db.Users.Where(u => u.Id == id)
                .Select(u => new { u.Id, u.UserName, u.AvatarKey, u.Bio, u.CreatedAt })
                .FirstOrDefaultAsync();

            if (user is null) return NotFound();
            var me = ViewerId();
            // Somebody who blocked me does not exist as far as I can tell; somebody I blocked shows as blocked so I can undo it.
            var iBlocked = me != Guid.Empty && await _db.UserBlocks.AnyAsync(b => b.BlockerId == me && b.BlockedId == id);
            if (!iBlocked && me != Guid.Empty && me != id && await BlockQueries.BetweenAsync(_db, me, id)) return NotFound();
            if (iBlocked) return Ok(new PublicProfileDto(user.Id, user.UserName, user.AvatarKey, null, user.CreatedAt, Relation.Blocked));
            var rows = await RowsAsync(me, new List<Guid> { id });
            // Public profile: no e-mail, no friend list, no friend count. Only what the person chose to show.
            return Ok(new PublicProfileDto(user.Id, user.UserName, user.AvatarKey, user.Bio, user.CreatedAt, Relation.Of(me, id, rows.GetValueOrDefault(id))));
        }

        private Guid ViewerId() => Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : Guid.Empty;

        /// <summary>The friendship rows between the viewer and each of the given people, by the other person's id.</summary>
        private async Task<Dictionary<Guid, Friendship>> RowsAsync(Guid me, List<Guid> others)
        {
            if (me == Guid.Empty || others.Count == 0) return new Dictionary<Guid, Friendship>();
            var rows = await _db.Friendships.Where(f => (f.UserAId == me && others.Contains(f.UserBId)) || (f.UserBId == me && others.Contains(f.UserAId))).ToListAsync();
            return rows.ToDictionary(f => f.UserAId == me ? f.UserBId : f.UserAId);
        }
    }
}
