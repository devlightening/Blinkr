using IdentityService.Application.Interfaces;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IdentityService.Api.Controllers
{
    public record UserSummaryDto(Guid Id, string UserName, string? AvatarKey = null);
    public record SetAvatarRequest(string? AvatarKey);

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

            return Ok(user);
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
            var results = await _db.Users
                .Where(u => EF.Functions.ILike(u.UserName, $"%{term}%"))
                .OrderBy(u => u.UserName)
                .Take(20)
                .Select(u => new UserSummaryDto(u.Id, u.UserName, u.AvatarKey))
                .ToListAsync();

            return Ok(results);
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var user = await _db.Users.Where(u => u.Id == id)
                .Select(u => new UserSummaryDto(u.Id, u.UserName, u.AvatarKey))
                .FirstOrDefaultAsync();

            if (user is null) return NotFound();
            return Ok(user);
        }
    }
}
