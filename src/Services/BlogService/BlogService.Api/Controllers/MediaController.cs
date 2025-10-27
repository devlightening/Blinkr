using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using BlogService.Api.Services;

namespace BlogService.Api.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize(Policy = "api.write")]
public class MediaController : ControllerBase
{
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png", 
        "image/webp",
        "video/mp4",
        "video/quicktime"
    };

    private readonly IObjectStorage _objectStorage;
    private readonly ILogger<MediaController> _logger;

    public MediaController(IObjectStorage objectStorage, ILogger<MediaController> logger)
    {
        _objectStorage = objectStorage;
        _logger = logger;
    }

    public record PresignRequest(string ContentType, long MaxBytes);

    /// <summary>
    /// Get presigned URL for media upload
    /// </summary>
    /// <param name="request">Upload request with content type and max bytes</param>
    /// <returns>Presigned upload information</returns>
    [HttpPost("presign")]
    [EnableRateLimiting("feed")] // Use same rate limiting as feed
    public async Task<IActionResult> Presign([FromBody] PresignRequest request)
    {
        try
        {
            // Validate content type
            if (!AllowedContentTypes.Contains(request.ContentType))
            {
                return BadRequest(new { 
                    error = "Unsupported content type",
                    message = "Desteklenmeyen dosya türü",
                    allowedTypes = AllowedContentTypes.ToArray()
                });
            }

            // Validate file size (8MB max)
            if (request.MaxBytes is < 1 or > 8_000_000)
            {
                return BadRequest(new { 
                    error = "Size out of range",
                    message = "Dosya boyutu 1 byte ile 8MB arasında olmalı",
                    minBytes = 1,
                    maxBytes = 8_000_000
                });
            }

            var userId = User.FindFirst("sub")?.Value ?? "anon";
            var key = $"u/{userId}/p/{Guid.NewGuid():N}";
            
            var presigned = await _objectStorage.GetPresignedPutAsync(
                key, 
                request.ContentType, 
                request.MaxBytes, 
                TimeSpan.FromMinutes(10)
            );

            // Prevent caching of presigned URLs
            Response.Headers.Append("Cache-Control", "no-store");
            
            _logger.LogInformation("Generated presigned URL for user: {UserId}, key: {Key}", userId, key);

            return Ok(presigned);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating presigned URL for user: {UserId}", User.FindFirst("sub")?.Value);
            return StatusCode(500, new { 
                error = "Internal server error",
                message = "Presigned URL oluşturulurken hata oluştu"
            });
        }
    }
}
