using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;
using IdentityService.Api.Account;
using Microsoft.EntityFrameworkCore;
using Shared.Moderation;
using System.Security.Claims;

namespace IdentityService.Api.Controllers
{
    public record DeleteAccountRequest(string? Password, int? GraceSeconds = null);
    public record ChangePasswordRequest(string? CurrentPassword, string? NewPassword, string? RefreshToken);

    /// <summary>
    /// My account's lifecycle (plan-devam F3/F4): asking for deletion (two-step in the app, password here), cancelling it
    /// within the 30-day grace, and asking for a copy of my data.
    /// </summary>
    [ApiController]
    [Authorize]
    public class AccountController : ControllerBase
    {
        public const int GraceDays = 30;
        private static readonly TimeSpan DataRequestWindow = TimeSpan.FromDays(30);
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        private readonly ILogger<AccountController> _logger;
        private readonly IMemoryCache _cache;

        public AccountController(AppDbContext db, IConfiguration config, ILogger<AccountController> logger, IMemoryCache cache)
        {
            _db = db;
            _config = config;
            _logger = logger;
            _cache = cache;
        }

        /// <summary>
        /// POST /api/users/me/password { currentPassword, newPassword, refreshToken } - change my password. The current one
        /// must be right (10 wrong tries lock it for 15 minutes, like sign-in, so a stolen session cannot guess it); the
        /// new one follows the sign-up rules (8-128) and must differ. Every other session ends: anyone who knew the old
        /// password is signed out, this device (the refresh token given) stays signed in.
        /// </summary>
        [HttpPost("api/users/me/password")]
        [EnableRateLimiting(AuthThrottle.Policy)]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var user = await CurrentAsync();
            if (user is null) return Unauthorized(new { error = "Unauthorized" });
            var lockKey = $"password-change:{user.Id}";
            if (AuthThrottle.IsLocked(_cache, lockKey))
                return StatusCode(StatusCodes.Status429TooManyRequests, new { error = AuthThrottle.ErrorCode, code = AuthThrottle.ErrorCode, message = "Çok fazla deneme yaptın. Biraz sonra tekrar dene." });
            if (string.IsNullOrEmpty(request?.CurrentPassword) || !BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            {
                AuthThrottle.RecordFailure(_cache, lockKey);
                return BadRequest(new { error = "WRONG_PASSWORD", code = "WRONG_PASSWORD", message = "Mevcut şifre doğru değil." });
            }
            AuthThrottle.RecordSuccess(_cache, lockKey);
            var next = request.NewPassword ?? string.Empty;
            if (next.Length < IdentityService.Infrastructure.Services.UserService.MinPasswordLength)
                return BadRequest(new { error = "PASSWORD_TOO_SHORT", code = "PASSWORD_TOO_SHORT", message = "Şifre en az 8 karakter olmalı." });
            if (next.Length > IdentityService.Infrastructure.Services.UserService.MaxPasswordLength)
                return BadRequest(new { error = "PASSWORD_TOO_LONG", code = "PASSWORD_TOO_LONG", message = "Şifre en fazla 128 karakter olabilir." });
            if (BCrypt.Net.BCrypt.Verify(next, user.PasswordHash))
                return BadRequest(new { error = "PASSWORD_UNCHANGED", code = "PASSWORD_UNCHANGED", message = "Yeni şifre eskisiyle aynı olamaz." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(next);
            var keep = string.IsNullOrWhiteSpace(request.RefreshToken) ? null : IdentityService.Infrastructure.Services.UserService.HashToken(request.RefreshToken);
            var now = DateTime.UtcNow;
            var others = await _db.RefreshTokens.Where(t => t.UserId == user.Id && t.RevokedAtUtc == null && t.TokenHash != keep).ToListAsync();
            foreach (var token in others) token.RevokedAtUtc = now;
            await _db.SaveChangesAsync();
            _logger.LogInformation("Password changed | UserId={UserId} SessionsEnded={Count}", user.Id, others.Count);
            return Ok(new { changed = true, sessionsEnded = others.Count });
        }

        /// <summary>
        /// POST /api/users/me/deletion - { password }. The account is erased in 30 days; signing in before then offers
        /// "Silmeyi geri al". Every session ends now (all refresh tokens are revoked).
        /// </summary>
        [HttpPost("api/users/me/deletion")]
        public async Task<IActionResult> RequestDeletion([FromBody] DeleteAccountRequest request)
        {
            var user = await CurrentAsync();
            if (user is null) return Unauthorized(new { error = "Unauthorized" });
            if (string.IsNullOrEmpty(request?.Password) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                return BadRequest(new { error = "WRONG_PASSWORD", message = "Şifre doğru değil." });

            var now = DateTime.UtcNow;
            // Development smoke tests may shorten the grace for their own test accounts only; real accounts always get 30 days.
            var grace = _config.GetValue<bool>("AccountDeletion:AllowShortGraceForTests") && TestAccounts.IsTestName(user.UserName) && request.GraceSeconds is { } seconds
                ? TimeSpan.FromSeconds(Math.Max(0, seconds))
                : TimeSpan.FromDays(GraceDays);
            user.DeletionRequestedAtUtc = now;
            user.DeletionScheduledForUtc = now.Add(grace);
            foreach (var token in await _db.RefreshTokens.Where(t => t.UserId == user.Id && t.RevokedAtUtc == null).ToListAsync())
                token.RevokedAtUtc = now;
            await _db.SaveChangesAsync();
            _logger.LogInformation("Account deletion requested | UserId={UserId}", user.Id);
            return Ok(new { deletionScheduledForUtc = user.DeletionScheduledForUtc });
        }

        /// <summary>DELETE /api/users/me/deletion - changed my mind: the account stays.</summary>
        [HttpDelete("api/users/me/deletion")]
        public async Task<IActionResult> CancelDeletion()
        {
            var user = await CurrentAsync();
            if (user is null) return Unauthorized(new { error = "Unauthorized" });
            user.DeletionRequestedAtUtc = null;
            user.DeletionScheduledForUtc = null;
            await _db.SaveChangesAsync();
            _logger.LogInformation("Account deletion cancelled | UserId={UserId}", user.Id);
            return Ok(new { deletionScheduledForUtc = (DateTime?)null });
        }

        /// <summary>POST /api/users/me/data-requests - ask for a copy of my data (at most one per 30 days; a repeat returns the open one).</summary>
        [HttpPost("api/users/me/data-requests")]
        public async Task<IActionResult> RequestData()
        {
            var user = await CurrentAsync();
            if (user is null) return Unauthorized(new { error = "Unauthorized" });
            var since = DateTime.UtcNow - DataRequestWindow;
            var open = await _db.DataRequests.Where(r => r.UserId == user.Id && r.CreatedAtUtc > since).OrderByDescending(r => r.CreatedAtUtc).FirstOrDefaultAsync();
            if (open is not null) return Ok(new { id = open.Id, createdAtUtc = open.CreatedAtUtc, status = open.Status, repeated = true });
            var request = new DataRequest { UserId = user.Id };
            _db.DataRequests.Add(request);
            await _db.SaveChangesAsync();
            // No mail is sent from here yet: the support address is still to be provided (D-021). The record is the queue.
            _logger.LogInformation("Data request received | UserId={UserId} | RequestId={RequestId}", user.Id, request.Id);
            return StatusCode(StatusCodes.Status201Created, new { id = request.Id, createdAtUtc = request.CreatedAtUtc, status = request.Status, repeated = false });
        }

        /// <summary>GET /api/users/me/data-requests - my latest request, or null.</summary>
        [HttpGet("api/users/me/data-requests")]
        public async Task<IActionResult> LatestDataRequest()
        {
            var user = await CurrentAsync();
            if (user is null) return Unauthorized(new { error = "Unauthorized" });
            var latest = await _db.DataRequests.Where(r => r.UserId == user.Id).OrderByDescending(r => r.CreatedAtUtc)
                .Select(r => new { id = r.Id, createdAtUtc = r.CreatedAtUtc, status = r.Status }).FirstOrDefaultAsync();
            return Ok(new { latest });
        }

        public record RevokeOthersRequest(string? RefreshToken);

        /// <summary>GET /api/users/me/sessions (S6) - my signed-in sessions (active refresh tokens), newest first. No device
        /// details are stored, so a session is its start and end.</summary>
        [HttpGet("api/users/me/sessions")]
        public async Task<IActionResult> Sessions()
        {
            var user = await CurrentAsync();
            if (user is null) return Unauthorized(new { error = "Unauthorized" });
            var now = DateTime.UtcNow;
            var sessions = await _db.RefreshTokens.Where(t => t.UserId == user.Id && t.RevokedAtUtc == null && t.ExpiresAtUtc > now)
                .OrderByDescending(t => t.CreatedAtUtc).Select(t => new { id = t.Id, createdAtUtc = t.CreatedAtUtc, expiresAtUtc = t.ExpiresAtUtc }).ToListAsync();
            return Ok(new { count = sessions.Count, items = sessions });
        }

        /// <summary>
        /// POST /api/users/me/sessions/revoke-others { refreshToken } (S6) - "sign out of every other device": every active
        /// session ends except the one this refresh token belongs to (which must be mine and active).
        /// </summary>
        [HttpPost("api/users/me/sessions/revoke-others")]
        public async Task<IActionResult> RevokeOthers([FromBody] RevokeOthersRequest request)
        {
            var user = await CurrentAsync();
            if (user is null) return Unauthorized(new { error = "Unauthorized" });
            if (string.IsNullOrWhiteSpace(request?.RefreshToken)) return BadRequest(new { error = "REFRESH_TOKEN_REQUIRED" });
            var keep = IdentityService.Infrastructure.Services.UserService.HashToken(request.RefreshToken);
            var now = DateTime.UtcNow;
            var active = await _db.RefreshTokens.Where(t => t.UserId == user.Id && t.RevokedAtUtc == null && t.ExpiresAtUtc > now).ToListAsync();
            if (!active.Any(t => t.TokenHash == keep)) return BadRequest(new { error = "SESSION_NOT_FOUND" });
            var others = active.Where(t => t.TokenHash != keep).ToList();
            foreach (var token in others) token.RevokedAtUtc = now;
            await _db.SaveChangesAsync();
            _logger.LogInformation("Sessions revoked | Count={Count}", others.Count);
            return Ok(new { revoked = others.Count });
        }

        private async Task<User?> CurrentAsync()
        {
            var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(raw, out var id)) return null;
            return await _db.Users.FirstOrDefaultAsync(u => u.Id == id && u.DeletedAtUtc == null);
        }
    }
}
