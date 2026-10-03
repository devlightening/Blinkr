using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PlaceService.Api.Application;
using PlaceService.Api.Infrastructure;

namespace PlaceService.Api.Controllers;

/// <summary>
/// "Yer özellikleri" (D-040). Reading is open like other place reads (voters are never returned; `myVote` and
/// `canVote` only describe the caller). Answering needs a recent server-verified visit to the place.
/// </summary>
[ApiController]
[Route("api/places")]
public class PlaceAttributesController : ControllerBase
{
    private readonly PlaceAttributeService _attributes;

    public PlaceAttributesController(PlaceAttributeService attributes) => _attributes = attributes;

    public record VoteRequest(bool? Value);

    /// <summary>GET /api/places/{id}/attributes - { attributes[{ key, state, voters, lastConfirmedAtUtc, fading, myVote }], canVote, catalog }.</summary>
    [HttpGet("{id:guid}/attributes")]
    [AllowAnonymous]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        Response.Headers.CacheControl = "private, no-store";
        return Ok(await _attributes.GetAsync(id, User.UserIdOrNull(), ct));
    }

    /// <summary>PUT /api/places/{id}/attributes/{key} - { value: true | false | null }.</summary>
    [HttpPut("{id:guid}/attributes/{key}")]
    [Authorize]
    public async Task<IActionResult> Vote(Guid id, string key, [FromBody] VoteRequest req, CancellationToken ct)
    {
        var me = User.UserIdOrNull();
        if (me is null) return Unauthorized();
        try
        {
            return Ok(await _attributes.VoteAsync(id, key, req?.Value, me.Value, ct));
        }
        catch (PlaceAttributeException ex)
        {
            var body = new { error = ex.Code, message = ex.Message };
            return ex.Code switch
            {
                PlaceAttributeException.NotEligibleCode => StatusCode(StatusCodes.Status403Forbidden, body),
                PlaceAttributeException.TooManyCode => StatusCode(StatusCodes.Status429TooManyRequests, body),
                PlaceAttributeException.NotFoundCode => NotFound(body),
                _ => BadRequest(body),
            };
        }
    }
}
