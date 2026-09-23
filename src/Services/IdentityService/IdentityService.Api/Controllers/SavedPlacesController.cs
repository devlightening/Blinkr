using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IdentityService.Api.Controllers
{
    public record SavedPlaceDto(Guid Id, string Name, string? Category, double Latitude, double Longitude, DateTime SavedAtUtc);
    public record SavePlaceRequest(string? Name, string? Category, double Latitude, double Longitude);
    public record ImportSavedPlace(Guid Id, string? Name, string? Category, double Latitude, double Longitude);
    public record ImportSavedPlacesRequest(IReadOnlyList<ImportSavedPlace>? Items);

    /// <summary>
    /// My saved places (sinyal-mvp-plan P6.8), the same on every device. Private to the account: there is no endpoint
    /// that reads anyone else's. The client imports what it saved on the device once, then the server is the truth.
    /// </summary>
    [ApiController]
    [Route("api/users/me/saved-places")]
    [Authorize]
    public class SavedPlacesController : ControllerBase
    {
        private readonly AppDbContext _db;

        public SavedPlacesController(AppDbContext db) => _db = db;

        private Guid Me() => Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : Guid.Empty;

        private async Task<List<SavedPlaceDto>> ListAsync(Guid me) =>
            await _db.SavedPlaces.Where(p => p.UserId == me)
                .OrderByDescending(p => p.CreatedAtUtc)
                .Select(p => new SavedPlaceDto(p.PlaceId, p.Name, p.Category, p.Latitude, p.Longitude, p.CreatedAtUtc))
                .ToListAsync();

        internal static bool Valid(string? name, double latitude, double longitude) =>
            !string.IsNullOrWhiteSpace(name) && latitude is >= -90 and <= 90 && longitude is >= -180 and <= 180
            && double.IsFinite(latitude) && double.IsFinite(longitude);

        private static string Clip(string value, int max) => value.Length <= max ? value : value[..max];

        /// <summary>GET /api/users/me/saved-places - newest first.</summary>
        [HttpGet]
        public async Task<IActionResult> List()
        {
            var me = Me();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            Response.Headers.CacheControl = "private, no-store";
            return Ok(await ListAsync(me));
        }

        /// <summary>PUT /api/users/me/saved-places/{placeId} - save (idempotent).</summary>
        [HttpPut("{placeId:guid}")]
        public async Task<IActionResult> Save(Guid placeId, [FromBody] SavePlaceRequest request)
        {
            var me = Me();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            if (request is null || !Valid(request.Name, request.Latitude, request.Longitude))
                return BadRequest(new { error = "INVALID_PLACE", message = "Yer bilgisi eksik." });

            var row = await _db.SavedPlaces.FirstOrDefaultAsync(p => p.UserId == me && p.PlaceId == placeId);
            if (row is null)
            {
                if (await _db.SavedPlaces.CountAsync(p => p.UserId == me) >= SavedPlaceRules.MaxPerUser)
                    return StatusCode(StatusCodes.Status429TooManyRequests, new { error = "SAVED_LIMIT", message = $"En fazla {SavedPlaceRules.MaxPerUser} yer kaydedebilirsin." });
                row = new SavedPlace { UserId = me, PlaceId = placeId };
                _db.SavedPlaces.Add(row);
            }
            row.Name = Clip(request.Name!.Trim(), SavedPlaceRules.MaxNameLength);
            row.Category = string.IsNullOrWhiteSpace(request.Category) ? null : Clip(request.Category.Trim(), SavedPlaceRules.MaxCategoryLength);
            row.Latitude = request.Latitude;
            row.Longitude = request.Longitude;
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { _db.ChangeTracker.Clear(); /* a parallel save of the same place won: same outcome */ }
            return Ok(new { placeId, saved = true });
        }

        /// <summary>DELETE /api/users/me/saved-places/{placeId} - idempotent.</summary>
        [HttpDelete("{placeId:guid}")]
        public async Task<IActionResult> Remove(Guid placeId)
        {
            var me = Me();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            var row = await _db.SavedPlaces.FirstOrDefaultAsync(p => p.UserId == me && p.PlaceId == placeId);
            if (row is not null)
            {
                _db.SavedPlaces.Remove(row);
                await _db.SaveChangesAsync();
            }
            return Ok(new { placeId, saved = false });
        }

        /// <summary>
        /// POST /api/users/me/saved-places/import - the places a device kept before sync existed. Adds what is new (up to
        /// the limit, older device saves first so they keep their order), skips invalid rows, answers the merged list.
        /// </summary>
        [HttpPost("import")]
        public async Task<IActionResult> Import([FromBody] ImportSavedPlacesRequest request)
        {
            var me = Me();
            if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
            var items = (request?.Items ?? Array.Empty<ImportSavedPlace>()).Take(SavedPlaceRules.MaxImportBatch).ToList();
            var existing = (await _db.SavedPlaces.Where(p => p.UserId == me).Select(p => p.PlaceId).ToListAsync()).ToHashSet();
            var room = SavedPlaceRules.MaxPerUser - existing.Count;
            var now = DateTime.UtcNow;
            var added = 0;
            // The device list comes newest first; insert oldest first with increasing timestamps to keep that order.
            for (var i = items.Count - 1; i >= 0 && added < room; i--)
            {
                var item = items[i];
                if (item.Id == Guid.Empty || existing.Contains(item.Id) || !Valid(item.Name, item.Latitude, item.Longitude)) continue;
                _db.SavedPlaces.Add(new SavedPlace
                {
                    UserId = me,
                    PlaceId = item.Id,
                    Name = Clip(item.Name!.Trim(), SavedPlaceRules.MaxNameLength),
                    Category = string.IsNullOrWhiteSpace(item.Category) ? null : Clip(item.Category.Trim(), SavedPlaceRules.MaxCategoryLength),
                    Latitude = item.Latitude,
                    Longitude = item.Longitude,
                    CreatedAtUtc = now.AddMilliseconds(-(i + 1)),
                });
                existing.Add(item.Id);
                added++;
            }
            try { await _db.SaveChangesAsync(); }
            catch (DbUpdateException) { _db.ChangeTracker.Clear(); /* a parallel import won the race */ }
            Response.Headers.CacheControl = "private, no-store";
            return Ok(await ListAsync(me));
        }
    }
}
