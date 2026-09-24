using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Shared.Moderation;
using System.Security.Claims;

namespace IdentityService.Api.Controllers
{
    public record DeleteAccountRequest(string? Password, int? GraceSeconds = null);

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

        public AccountController(AppDbContext db, IConfiguration config, ILogger<AccountController> logger)
        {
            _db = db;
            _config = config;
            _logger = logger;
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

        private async Task<User?> CurrentAsync()
        {
            var raw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(raw, out var id)) return null;
            return await _db.Users.FirstOrDefaultAsync(u => u.Id == id && u.DeletedAtUtc == null);
        }
    }
}
