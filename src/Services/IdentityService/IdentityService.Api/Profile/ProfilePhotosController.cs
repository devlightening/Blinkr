using System.Collections.Concurrent;
using System.Security.Claims;
using System.Security.Cryptography;
using IdentityService.Api.Controllers;
using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Api.Profile;

/// <summary>
/// Optional profile photo (D-032). The drawn avatar stays the default and the fallback. The app crops and resizes on the
/// phone and sends two JPEGs (profile ~640 px, lists ~160 px); metadata (EXIF with GPS position) is dropped before
/// anything is stored. Photos are never served as static files: every read is authenticated and goes through the same
/// block rule as the profile, and the address carries a random version, so it cannot be guessed and caches never show
/// an old photo. Map pins and anonymous signals never show a photo (the app never asks for one there).
/// </summary>
[ApiController]
[Authorize]
public sealed class ProfilePhotosController : ControllerBase
{
    private static readonly ConcurrentDictionary<Guid, (DateOnly Day, int Count)> Changes = new();
    private readonly AppDbContext _db;
    private readonly ProfilePhotoStore _store;
    private readonly ILogger<ProfilePhotosController> _logger;

    public ProfilePhotosController(AppDbContext db, ProfilePhotoStore store, ILogger<ProfilePhotosController> logger)
    {
        _db = db;
        _store = store;
        _logger = logger;
    }

    /// <summary>PUT /api/users/me/photo (multipart: <c>large</c>, <c>small</c>, both JPEG) - set a new photo.</summary>
    [HttpPut("api/users/me/photo")]
    [RequestSizeLimit(ProfilePhotoRules.MaxLargeBytes + ProfilePhotoRules.MaxSmallBytes + 64 * 1024)]
    public async Task<IActionResult> Set([FromForm] IFormFile? large, [FromForm] IFormFile? small, CancellationToken ct)
    {
        var me = Me();
        if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
        if (large is null || small is null) return BadRequest(new { error = "PHOTO_MISSING" });
        if (large.Length > ProfilePhotoRules.MaxLargeBytes || small.Length > ProfilePhotoRules.MaxSmallBytes) return BadRequest(new { error = "PHOTO_TOO_LARGE" });

        var largeBytes = await ReadAsync(large, ct);
        var smallBytes = await ReadAsync(small, ct);
        if (!ProfilePhotoStore.IsJpeg(largeBytes) || !ProfilePhotoStore.IsJpeg(smallBytes)) return BadRequest(new { error = "PHOTO_NOT_JPEG" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == me && u.DeletedAtUtc == null, ct);
        if (user is null) return NotFound(new { error = "USER_NOT_FOUND" });
        if (!TakeChange(me)) return StatusCode(StatusCodes.Status429TooManyRequests, new { error = "TOO_MANY_PHOTO_CHANGES" });

        var version = Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
        await _store.SaveAsync(me, version, ProfilePhotoStore.StripJpegMetadata(largeBytes), ProfilePhotoStore.StripJpegMetadata(smallBytes), ct);
        var previous = user.PhotoVersion;
        user.PhotoVersion = version;
        await _db.SaveChangesAsync(ct);
        if (previous is not null) _store.Delete(me, previous);
        _logger.LogInformation("Profile photo set | UserId={UserId} | Bytes={Large}/{Small}", me, largeBytes.Length, smallBytes.Length);
        return Ok(new { photoVersion = version });
    }

    /// <summary>DELETE /api/users/me/photo - back to the drawn avatar.</summary>
    [HttpDelete("api/users/me/photo")]
    public async Task<IActionResult> Remove(CancellationToken ct)
    {
        var me = Me();
        if (me == Guid.Empty) return Unauthorized(new { error = "Unauthorized" });
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == me && u.DeletedAtUtc == null, ct);
        if (user is null) return NotFound(new { error = "USER_NOT_FOUND" });
        if (user.PhotoVersion is { } version)
        {
            user.PhotoVersion = null;
            await _db.SaveChangesAsync(ct);
            _store.Delete(me, version);
        }
        return Ok(new { photoVersion = (string?)null });
    }

    /// <summary>
    /// GET /api/users/{id}/photo?s=small|large&amp;v= - the photo. 404 when there is none, the account is gone, or a block
    /// stands either way (the same as the profile). A private account's full-size photo is for approved followers;
    /// everyone else gets the small one, which lists show anyway.
    /// </summary>
    [HttpGet("api/users/{id:guid}/photo")]
    public async Task<IActionResult> Get(Guid id, [FromQuery] string? s, [FromQuery] string? v, CancellationToken ct)
    {
        var me = Me();
        var user = await _db.Users.Where(u => u.Id == id && u.DeletedAtUtc == null).Select(u => new { u.PhotoVersion }).FirstOrDefaultAsync(ct);
        if (user?.PhotoVersion is null) return NotFound();
        if (me != id && await BlockQueries.BetweenAsync(_db, me, id)) return NotFound();
        var wantLarge = string.Equals(s, "large", StringComparison.OrdinalIgnoreCase);
        if (wantLarge && me != id && !await FollowQueries.CanSeeAsync(_db, me, id)) wantLarge = false;
        var bytes = await _store.ReadAsync(id, user.PhotoVersion, wantLarge, ct);
        if (bytes is null) return NotFound();
        // A stale version is still answered with the current photo, but only the current address may be cached for long.
        Response.Headers.CacheControl = v == user.PhotoVersion ? "private, max-age=86400" : "private, no-store";
        return File(bytes, "image/jpeg");
    }

    private Guid Me() => Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : Guid.Empty;

    private static async Task<byte[]> ReadAsync(IFormFile file, CancellationToken ct)
    {
        using var buffer = new MemoryStream((int)file.Length);
        await file.CopyToAsync(buffer, ct);
        return buffer.ToArray();
    }

    /// <summary>In memory (one instance, like the other identity counters, D-030): at most N new photos a day.</summary>
    private static bool TakeChange(Guid userId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var allowed = false;
        Changes.AddOrUpdate(userId, _ => { allowed = true; return (today, 1); }, (_, current) =>
        {
            var count = current.Day == today ? current.Count : 0;
            if (count >= ProfilePhotoRules.MaxChangesPerDay) { allowed = false; return current; }
            allowed = true;
            return (today, count + 1);
        });
        return allowed;
    }
}

/// <summary>Profile photos on a private disk folder (never served by a static file middleware).</summary>
public sealed class ProfilePhotoStore
{
    private readonly string _root;
    private readonly ILogger<ProfilePhotoStore> _logger;

    public ProfilePhotoStore(IConfiguration configuration, IWebHostEnvironment env, ILogger<ProfilePhotoStore> logger)
    {
        _root = Path.GetFullPath(configuration["Storage:ProfilePhotos"] ?? Path.Combine(env.ContentRootPath, "App_Data", "profile-photos"));
        _logger = logger;
        Directory.CreateDirectory(_root);
    }

    private string FileOf(Guid userId, string version, bool large) =>
        Path.Combine(_root, userId.ToString("N"), $"{version}-{(large ? "l" : "s")}.jpg");

    public async Task SaveAsync(Guid userId, string version, byte[] large, byte[] small, CancellationToken ct)
    {
        Directory.CreateDirectory(Path.Combine(_root, userId.ToString("N")));
        await File.WriteAllBytesAsync(FileOf(userId, version, true), large, ct);
        await File.WriteAllBytesAsync(FileOf(userId, version, false), small, ct);
    }

    public async Task<byte[]?> ReadAsync(Guid userId, string version, bool large, CancellationToken ct)
    {
        var path = FileOf(userId, version, large);
        return File.Exists(path) ? await File.ReadAllBytesAsync(path, ct) : null;
    }

    public void Delete(Guid userId, string version)
    {
        foreach (var large in new[] { true, false })
        {
            try { File.Delete(FileOf(userId, version, large)); }
            catch (IOException ex) { _logger.LogWarning(ex, "Profile photo file could not be deleted | UserId={UserId}", userId); }
        }
    }

    /// <summary>Every photo of a person (account erased).</summary>
    public void DeleteAll(Guid userId)
    {
        var folder = Path.Combine(_root, userId.ToString("N"));
        try { if (Directory.Exists(folder)) Directory.Delete(folder, recursive: true); }
        catch (IOException ex) { _logger.LogWarning(ex, "Profile photo folder could not be deleted | UserId={UserId}", userId); }
    }

    public static bool IsJpeg(byte[] bytes) => bytes.Length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;

    /// <summary>Drops the APP0-APP15 segments (EXIF with GPS position, camera, time) and keeps the picture. Same rule as snaps.</summary>
    public static byte[] StripJpegMetadata(byte[] bytes)
    {
        if (bytes.Length < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8) return bytes;
        using var output = new MemoryStream(bytes.Length);
        output.Write(bytes, 0, 2);
        var index = 2;
        while (index + 4 <= bytes.Length && bytes[index] == 0xFF)
        {
            var marker = bytes[index + 1];
            if (marker == 0xDA) break;
            var segmentLength = (bytes[index + 2] << 8) + bytes[index + 3];
            if (segmentLength < 2 || index + 2 + segmentLength > bytes.Length) break;
            if (marker is not (>= 0xE0 and <= 0xEF)) output.Write(bytes, index, segmentLength + 2);
            index += segmentLength + 2;
        }
        output.Write(bytes, index, bytes.Length - index);
        return output.ToArray();
    }
}
