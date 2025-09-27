using IdentityModel.Client;
using IdentityService.Application.DTOs;
using IdentityService.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace IdentityService.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController(IUserService _userService, IHttpClientFactory _httpClientFactory) : ControllerBase
    {

        [HttpPost]
        public async Task<IActionResult> Register([FromBody] RegisterUserDto dto)
        {
            var userId = await _userService.RegisterAsync(dto);
            return Ok(new { UserId = userId });
        }


        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest dto)
        {
            var client = _httpClientFactory.CreateClient();

            var disco = await client.GetDiscoveryDocumentAsync("https://localhost:7122");
            if (disco.IsError)
                return BadRequest(disco.Error);

            var tokenResponse = await client.RequestPasswordTokenAsync(new PasswordTokenRequest
            {
                Address = disco.TokenEndpoint,
                ClientId = "blinkr.ro.client",
                ClientSecret = "super_secret",
                UserName = dto.UserName,
                Password = dto.Password,
                Scope = "openid profile roles blinkr.api.read blinkr.api.write offline_access"
            });

            if (tokenResponse.IsError)
                return BadRequest(tokenResponse.Error);

            return Ok(new
            {
                access_token = tokenResponse.AccessToken,
                refresh_token = tokenResponse.RefreshToken,
                expires_in = tokenResponse.ExpiresIn
            });
        }
    }

}
