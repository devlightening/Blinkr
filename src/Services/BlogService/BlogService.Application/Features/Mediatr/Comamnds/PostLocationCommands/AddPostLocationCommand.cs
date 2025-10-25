using MediatR;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostLocationCommands;

/// <summary>
/// Command to add location to a post
/// </summary>
/// <param name="PostId">Post identifier</param>
/// <param name="Latitude">Latitude coordinate (-90 to 90)</param>
/// <param name="Longitude">Longitude coordinate (-180 to 180)</param>
/// <param name="LocationName">Optional location name (auto-filled via geocoding if null)</param>
/// <param name="Precision">Location precision for privacy control</param>
public record AddPostLocationCommand(
    Guid PostId,
    double Latitude,
    double Longitude,
    string? LocationName = null,
    LocationPrecision Precision = LocationPrecision.Precise
) : IRequest;
