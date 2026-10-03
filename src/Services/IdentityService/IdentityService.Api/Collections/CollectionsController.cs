using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IdentityService.Api.Collections;

public record CreateCollectionRequest(string? Title, string? Description);
public record UpdateCollectionRequest(string? Title, string? Description, string? Visibility, bool? NewLink);
public record CollectionItemRequest(string? Name, string? Category, double Latitude, double Longitude, string? Note);

/// <summary>
/// "Koleksiyonlar" (D-041). The owner works under /api/users/me/collections; a list shared by link is read at
/// /api/collections/shared/{token} by anyone signed in (blocks and private lists answer 404).
/// </summary>
[ApiController]
[Authorize]
public class CollectionsController : ControllerBase
{
    private readonly PlaceCollectionService _collections;

    public CollectionsController(PlaceCollectionService collections) => _collections = collections;

    private Guid Me() => Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : Guid.Empty;

    private async Task<IActionResult> Run<T>(Func<Guid, Task<T>> action)
    {
        var me = Me();
        if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
        Response.Headers.CacheControl = "private, no-store";
        try
        {
            return Ok(await action(me));
        }
        catch (CollectionException ex)
        {
            var body = new { error = ex.Code, code = ex.Code, message = ex.Message };
            return ex.Code switch
            {
                CollectionException.NotFound => NotFound(body),
                CollectionException.Limit or CollectionException.ItemsLimit => StatusCode(StatusCodes.Status429TooManyRequests, body),
                CollectionException.Blocked => UnprocessableEntity(body),
                _ => BadRequest(body),
            };
        }
    }

    [HttpGet("api/users/me/collections")]
    public Task<IActionResult> List(CancellationToken ct) => Run(me => _collections.ListMineAsync(me, ct));

    [HttpPost("api/users/me/collections")]
    public Task<IActionResult> Create([FromBody] CreateCollectionRequest req, CancellationToken ct) =>
        Run(me => _collections.CreateAsync(me, req?.Title, req?.Description, ct));

    [HttpGet("api/users/me/collections/{id:guid}")]
    public Task<IActionResult> Get(Guid id, CancellationToken ct) => Run(me => _collections.GetMineAsync(me, id, ct));

    /// <summary>{ title?, description?, visibility?: private | link, newLink? } - null fields stay as they are.</summary>
    [HttpPut("api/users/me/collections/{id:guid}")]
    public Task<IActionResult> Update(Guid id, [FromBody] UpdateCollectionRequest req, CancellationToken ct) =>
        Run(me => _collections.UpdateAsync(me, id, req?.Title, req?.Description, req?.Visibility, req?.NewLink == true, ct));

    [HttpDelete("api/users/me/collections/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var me = Me();
        if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
        await _collections.DeleteAsync(me, id, ct);
        return NoContent();
    }

    [HttpPut("api/users/me/collections/{id:guid}/items/{placeId:guid}")]
    public Task<IActionResult> PutItem(Guid id, Guid placeId, [FromBody] CollectionItemRequest req, CancellationToken ct) =>
        Run(me => _collections.PutItemAsync(me, id, placeId, req?.Name, req?.Category, req?.Latitude ?? double.NaN, req?.Longitude ?? double.NaN, req?.Note, ct));

    [HttpDelete("api/users/me/collections/{id:guid}/items/{placeId:guid}")]
    public Task<IActionResult> RemoveItem(Guid id, Guid placeId, CancellationToken ct) => Run(me => _collections.RemoveItemAsync(me, id, placeId, ct));

    [HttpGet("api/collections/shared/{token}")]
    public Task<IActionResult> Shared(string token, CancellationToken ct) => Run(me => _collections.GetSharedAsync(me, token, ct));
}
