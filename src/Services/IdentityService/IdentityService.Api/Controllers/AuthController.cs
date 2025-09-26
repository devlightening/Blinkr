using IdentityService.Application.DTOs;
using IdentityService.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace IdentityService.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController(IUserService _userService) : ControllerBase
    {

        [HttpPost]
       public async Task<IActionResult> Register([FromBody] RegisterUserDto dto)
        {
            var userId = await _userService.RegisterAsync(dto);
            return Ok(new { UserId = userId });
        }
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] RegisterUserDto dto)
        {
            var token = await _userService.LoginAsync(dto.Email, dto.Password);
            return Ok(new { Token = token });
        }
    }
}
