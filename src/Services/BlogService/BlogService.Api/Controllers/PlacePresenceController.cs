using BlogService.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogService.Api.Controllers;

[ApiController]
[Route("api/posts/place-presence")]
[Authorize(Policy = "api.write")]
public sealed class PlacePresenceController(IPlaceLookupService places, IPlaceProximityPolicy policy) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Evaluate(PresenceInput input, CancellationToken ct)
    {
        var place = await places.GetAsync(input.PlaceId, ct);
        if (place is null) return NotFound();
        var decision = policy.Evaluate(new PlaceProximityRequest(
            "GeneralObservation", place.Latitude, place.Longitude,
            input.Latitude, input.Longitude, input.AccuracyMeters, place.GeometryWkt));
        return Ok(decision);
    }
}

public sealed record PresenceInput(Guid PlaceId, double Latitude, double Longitude, double AccuracyMeters);
