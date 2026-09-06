using BlogService.Api.Extensions;
using BlogService.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MongoDB.Driver;

namespace BlogService.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/media")]
public class MediaController : ControllerBase
{
    private readonly IMediaAttachmentService _media;
    private readonly IMongoDatabase _database;
    private readonly IWebHostEnvironment _env;

    public MediaController(IMediaAttachmentService media, IMongoDatabase database, IWebHostEnvironment env)
    {
        _media = media;
        _database = database;
        _env = env;
    }

    [HttpPost("presign")]
    [Authorize(Policy = "api.write")]
    [EnableRateLimiting("feed")]
    public async Task<IActionResult> Presign([FromBody] CreateMediaUploadRequest request, CancellationToken ct)
    {
        try
        {
            var userId = User.GetUserId() ?? throw new UnauthorizedAccessException("User not authenticated.");
            var authorization = await _media.CreateUploadAsync(userId, request, ct);
            Response.Headers.Append("Cache-Control", "no-store");
            return Ok(authorization);
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new { error = "media_limit_exceeded", message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = "invalid_media_request", message = ex.Message });
        }
    }

    [HttpPut("uploads/{mediaId:guid}/content")]
    [Authorize(Policy = "api.write")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Upload(Guid mediaId, CancellationToken ct)
    {
        try
        {
            var userId = User.GetUserId() ?? throw new UnauthorizedAccessException("User not authenticated.");
            var contentType = Request.ContentType?.Split(';')[0].Trim() ?? string.Empty;
            await _media.MarkUploadedAsync(userId, mediaId, Request.Body, contentType, ct);
            return Ok(new { mediaId, status = "Uploaded" });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = "media_not_found", message = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden" });
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new { error = "media_limit_exceeded", message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = "invalid_media_upload", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = "invalid_media_state", message = ex.Message });
        }
    }

    [HttpGet("uploads/{mediaId:guid}")]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> GetUpload(Guid mediaId, CancellationToken ct)
    {
        var userId = User.GetUserId() ?? throw new UnauthorizedAccessException("User not authenticated.");
        var upload = await _media.GetUploadAsync(userId, mediaId, ct);
        return upload is null ? NotFound(new { error = "media_not_found" }) : Ok(upload);
    }

    [HttpGet("public/{mediaId:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> Public(Guid mediaId, CancellationToken ct)
    {
        var uploads = _database.GetCollection<BlogService.Api.Services.MediaUploadDocument>("media_uploads");
        var doc = await uploads.Find(x => x.Id == mediaId && x.Status == "ATTACHED").FirstOrDefaultAsync(ct);
        if (doc is null) return NotFound();

        var path = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "artifacts/media", doc.ObjectKey.Replace('/', Path.DirectorySeparatorChar)));
        if (!System.IO.File.Exists(path)) return NotFound();
        return PhysicalFile(path, doc.ContentType, enableRangeProcessing: true);
    }
}
