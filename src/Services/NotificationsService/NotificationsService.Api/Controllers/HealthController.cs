using Microsoft.AspNetCore.Mvc;

namespace NotificationsService.Api.Controllers;

[ApiController]
[Route("health")]
public class HealthController : ControllerBase
{
    [HttpGet] public IActionResult Get() => Ok(new { ok = true, service = "notifications" });
}