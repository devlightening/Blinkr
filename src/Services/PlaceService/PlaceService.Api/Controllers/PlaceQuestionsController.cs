using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlaceService.Api.Application;
using PlaceService.Api.Infrastructure;

namespace PlaceService.Api.Controllers;

/// <summary>
/// "Yere sor" (D-039). Asking needs a signed-in person; reading is open like other place reads, but never says who asked
/// (`askedByMe` only for the caller). Answering has no endpoint: a VERIFIED_LIVE signal of the matching kind answers.
/// </summary>
[ApiController]
[Route("api/places")]
public class PlaceQuestionsController : ControllerBase
{
    private readonly PlaceQuestionService _questions;

    public PlaceQuestionsController(PlaceQuestionService questions) => _questions = questions;

    public record AskRequest(string? Kind);

    /// <summary>POST /api/places/{id}/questions - { kind: crowd | queue | open }; joins an open question of that kind.</summary>
    [HttpPost("{id:guid}/questions")]
    [Authorize]
    public async Task<IActionResult> Ask(Guid id, [FromBody] AskRequest req, CancellationToken ct)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        try
        {
            return Ok(await _questions.AskAsync(id, req?.Kind, me.Value, ct));
        }
        catch (PlaceQuestionException ex)
        {
            var body = new { error = ex.Code, message = ex.Message };
            return ex.Code switch
            {
                PlaceQuestionException.LimitCode => Conflict(body),
                PlaceQuestionException.NotFoundCode => NotFound(body),
                _ => BadRequest(body),
            };
        }
    }

    /// <summary>DELETE /api/places/{id}/questions/{kind} - I no longer wait for it.</summary>
    [HttpDelete("{id:guid}/questions/{kind}")]
    [Authorize]
    public async Task<IActionResult> Withdraw(Guid id, string kind, CancellationToken ct)
    {
        var me = CurrentUserId();
        if (me is null) return Unauthorized();
        await _questions.WithdrawAsync(id, kind, me.Value, ct);
        return NoContent();
    }

    /// <summary>GET /api/places/{id}/questions - open and recently answered questions of the place (last hour).</summary>
    [HttpGet("{id:guid}/questions")]
    [AllowAnonymous]
    public async Task<IActionResult> ForPlace(Guid id, CancellationToken ct)
    {
        Response.Headers.CacheControl = "private, no-store";
        return Ok(await _questions.ForPlaceAsync(id, CurrentUserId(), ct));
    }

    /// <summary>GET /api/places/questions/nearby?lat&amp;lon&amp;radiusMeters - open questions around me, to answer if I am there.</summary>
    [HttpGet("questions/nearby")]
    [AllowAnonymous]
    public async Task<IActionResult> Nearby([FromQuery] double lat, [FromQuery] double lon, [FromQuery] int radiusMeters = 1500, CancellationToken ct = default)
    {
        if (lat is < -90 or > 90 || lon is < -180 or > 180) return BadRequest(new { error = PlaceQuestionException.InvalidCode });
        Response.Headers.CacheControl = "private, no-store";
        return Ok(await _questions.NearAsync(lat, lon, radiusMeters, CurrentUserId(), ct));
    }

    private Guid? CurrentUserId() => User.UserIdOrNull();
}
