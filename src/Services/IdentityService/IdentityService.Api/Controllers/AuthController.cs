using IdentityService.Application.DTOs;
using IdentityService.Application.Interfaces;
using IdentityService.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace IdentityService.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IUserService _userService;

        public AuthController(IUserService userService)
        {
            _userService = userService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            var result = await _userService.RegisterAsync(request);
            if (result.Succeeded) return Ok(result.Auth);

            var body = new { error = result.ErrorCode, message = result.ErrorMessage };
            return result.ErrorCode is "USERNAME_TAKEN" or "EMAIL_TAKEN" ? Conflict(body) : BadRequest(body);
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            AuthResponse? response;
            try { response = await _userService.LoginAsync(request); }
            catch (AccountSuspendedException ex)
            {
                var closed = ex.UntilUtc >= Sanctions.Forever;
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    error = "ACCOUNT_SUSPENDED",
                    code = "ACCOUNT_SUSPENDED",
                    until = closed ? (DateTime?)null : ex.UntilUtc,
                    message = closed ? "Bu hesap topluluk kurallarını ihlal ettiği için kapatıldı." : "Bu hesap topluluk kuralları nedeniyle geçici olarak askıya alındı.",
                });
            }
            // A code the app translates (it used to be plain English text, shown as-is even in Turkish).
            if (response == null) return Unauthorized(new { error = "INVALID_CREDENTIALS", code = "INVALID_CREDENTIALS", message = "Kullanıcı adı veya şifre hatalı." });
            return Ok(response);
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request)
        {
            var response = await _userService.RefreshTokenAsync(request.RefreshToken);
            if (response == null) return Unauthorized("Invalid refresh token.");
            return Ok(response);
        }
    }

    public class RefreshTokenRequest
    {
        public string RefreshToken { get; set; } = string.Empty;
    }
}
