using IdentityService.Application.DTOs;
using IdentityService.Application.Interfaces;
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
            var response = await _userService.LoginAsync(request);
            if (response == null) return Unauthorized("Invalid credentials.");
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
