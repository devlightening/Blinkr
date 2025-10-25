using BlogService.Application.Features.Mediatr.Comamnds.PostLocationCommands;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace BlogService.Api.Controllers;

/// <summary>
/// Controller for managing post location operations
/// </summary>
[ApiController]
[Route("api/posts/{postId:guid}/location")]
[Authorize]
[Produces("application/json")]
public class PostsLocationController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<PostsLocationController> _logger;

    public PostsLocationController(IMediator mediator, ILogger<PostsLocationController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// Add location to a post
    /// </summary>
    /// <param name="postId">Post ID</param>
    /// <param name="request">Location data</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Success response</returns>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddLocation(
        Guid postId, 
        [FromBody] AddLocationRequest request, 
        CancellationToken ct = default)
    {
        try
        {
            var command = new AddPostLocationCommand(
                postId,
                request.Latitude,
                request.Longitude,
                request.LocationName,
                request.Precision ?? LocationPrecision.Precise
            );

            await _mediator.Send(command, ct);

            _logger.LogInformation(
                "📍 Location added to post: PostId={PostId}, Lat={Lat}, Lon={Lon}",
                postId, request.Latitude, request.Longitude);

            return Ok(new { message = "Location added successfully" });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid location data for post: PostId={PostId}", postId);
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to add location to post: PostId={PostId}", postId);
            return StatusCode(500, new { error = "An error occurred while adding location" });
        }
    }

    /// <summary>
    /// Update post location
    /// </summary>
    /// <param name="postId">Post ID</param>
    /// <param name="request">Updated location data</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Success response</returns>
    [HttpPut]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateLocation(
        Guid postId, 
        [FromBody] UpdateLocationRequest request, 
        CancellationToken ct = default)
    {
        try
        {
            var command = new UpdatePostLocationCommand(
                postId,
                request.Latitude,
                request.Longitude,
                request.LocationName,
                request.Precision ?? LocationPrecision.Precise
            );

            await _mediator.Send(command, ct);

            _logger.LogInformation(
                "📍 Location updated for post: PostId={PostId}, Lat={Lat}, Lon={Lon}",
                postId, request.Latitude, request.Longitude);

            return Ok(new { message = "Location updated successfully" });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid location data for post: PostId={PostId}", postId);
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update location for post: PostId={PostId}", postId);
            return StatusCode(500, new { error = "An error occurred while updating location" });
        }
    }

    /// <summary>
    /// Remove location from post
    /// </summary>
    /// <param name="postId">Post ID</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Success response</returns>
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveLocation(Guid postId, CancellationToken ct = default)
    {
        try
        {
            var command = new RemovePostLocationCommand(postId);
            await _mediator.Send(command, ct);

            _logger.LogInformation("📍 Location removed from post: PostId={PostId}", postId);

            return Ok(new { message = "Location removed successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove location from post: PostId={PostId}", postId);
            return StatusCode(500, new { error = "An error occurred while removing location" });
        }
    }
}

/// <summary>
/// Request model for adding location to post
/// </summary>
public record AddLocationRequest
{
    /// <summary>
    /// Latitude coordinate (-90 to 90)
    /// </summary>
    [Required]
    [Range(-90.0, 90.0, ErrorMessage = "Latitude must be between -90 and 90")]
    public double Latitude { get; init; }

    /// <summary>
    /// Longitude coordinate (-180 to 180)
    /// </summary>
    [Required]
    [Range(-180.0, 180.0, ErrorMessage = "Longitude must be between -180 and 180")]
    public double Longitude { get; init; }

    /// <summary>
    /// Optional location name (auto-filled via geocoding if null)
    /// </summary>
    public string? LocationName { get; init; }

    /// <summary>
    /// Location precision for privacy control
    /// </summary>
    public LocationPrecision? Precision { get; init; }
}

/// <summary>
/// Request model for updating post location
/// </summary>
public record UpdateLocationRequest
{
    /// <summary>
    /// Latitude coordinate (-90 to 90)
    /// </summary>
    [Required]
    [Range(-90.0, 90.0, ErrorMessage = "Latitude must be between -90 and 90")]
    public double Latitude { get; init; }

    /// <summary>
    /// Longitude coordinate (-180 to 180)
    /// </summary>
    [Required]
    [Range(-180.0, 180.0, ErrorMessage = "Longitude must be between -180 and 180")]
    public double Longitude { get; init; }

    /// <summary>
    /// Optional location name (auto-filled via geocoding if null)
    /// </summary>
    public string? LocationName { get; init; }

    /// <summary>
    /// Location precision for privacy control
    /// </summary>
    public LocationPrecision? Precision { get; init; }
}
