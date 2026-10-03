using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotificationsService.Application.PlaceWatches;

namespace NotificationsService.Api.Controllers;

/// <summary>
/// "Haber ver" (D-038): my own place watches. GET lists them, PUT /{placeId} starts or changes one
/// ({ condition: calm | open | update, placeName }), DELETE /{placeId} stops it. Only the owner ever reads them.
/// </summary>
[ApiController]
[Route("api/place-watches")]
[Authorize]
public class PlaceWatchesController : ControllerBase
{
    private readonly IMediator _mediator;

    public PlaceWatchesController(IMediator mediator) => _mediator = mediator;

    public record WatchRequest(string? Condition, string? PlaceName);

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) =>
        Ok(await _mediator.Send(new ListPlaceWatchesQuery(User.GetUserId()), ct));

    [HttpPut("{placeId:guid}")]
    public async Task<IActionResult> Watch(Guid placeId, [FromBody] WatchRequest req, CancellationToken ct)
    {
        try
        {
            return Ok(await _mediator.Send(new WatchPlaceCommand(User.GetUserId(), placeId, req?.PlaceName, req?.Condition), ct));
        }
        catch (PlaceWatchException ex)
        {
            var body = new { error = ex.Code, message = ex.Message };
            return ex.IsLimit ? Conflict(body) : BadRequest(body);
        }
    }

    [HttpDelete("{placeId:guid}")]
    public async Task<IActionResult> Unwatch(Guid placeId, CancellationToken ct)
    {
        await _mediator.Send(new UnwatchPlaceCommand(User.GetUserId(), placeId), ct);
        return NoContent();
    }
}
