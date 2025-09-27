using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IdentityService.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SecureTestController : ControllerBase
    {
     
        [HttpGet("me")]
        [Authorize]
        public IActionResult GetMe()
        {
            var claims = User.Claims.Select(c => new { c.Type, c.Value });
            return Ok(new
            {
                Message = "You are authorized ",
                Claims = claims
            });
        }


        [HttpGet("public")]
        [AllowAnonymous]
        public IActionResult PublicEndpoint()
        {
            return Ok("This is a public endpoint ");
        }
    }
}
