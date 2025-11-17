using MediatR;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostLocationCommands;

/// <summary>
/// Command to update post location
/// </summary>
/// <param name="PostId">Post identifier</param>
/// <param name="Latitude">New latitude coordinate (-90 to 90)</param>
/// <param name="Longitude">New longitude coordinate (-180 to 180)</param>
/// <param name="LocationName">Optional location name (auto-filled via geocoding if null)</param>
/// <param name="Precision">Location precision for privacy control</param>
public record UpdatePostLocationCommand(
    Guid PostId,
    double Latitude,
    double Longitude,
    string? LocationName = null,
    LocationPrecision Precision = LocationPrecision.Precise
) : IRequest<Unit>;
