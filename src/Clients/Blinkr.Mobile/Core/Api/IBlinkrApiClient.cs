using Refit;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Blinkr.Mobile.Core.Api;

public interface IBlinkrApiClient
{
    /// <summary>
    /// Get nearby posts - Backend returns List<PostLocationDto> directly with Lat/Lng
    /// </summary>
    [Get("/api/posts/nearby")]
    Task<List<PostLocationDto>> GetNearbyPosts(
        [Query] double lat,
        [Query] double lng,
        [Query] double radiusKm = 5.0);
}

// DTOs
/// <summary>
/// Lightweight DTO for map markers - matches backend response
/// </summary>
public record PostLocationDto(
    Guid Id,
    string Title,
    double Lat,
    double Lng,
    string? MediaUrl = null);
