using Refit;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Blinkr.Mobile.Core.Api;

public interface IBlinkrApiClient
{
    /// <summary>
    /// Get nearby posts - Backend returns List of PostLocationDto directly with Lat/Lng
    /// </summary>
    [Get("/api/posts/nearby")]
    Task<List<PostLocationDto>> GetNearbyPosts(
        [Query] double lat,
        [Query] double lng,
        [Query] double radiusKm = 5.0);
    
    /// <summary>
    /// Get full post detail by ID
    /// </summary>
    [Get("/api/posts/{id}")]
    Task<PostDetailDto?> GetPostById(Guid id);
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
    string? MediaUrl = null,
    string? AuthorGender = null);

/// <summary>
/// Full post detail DTO - matches backend PostResponseDto
/// </summary>
public record PostDetailDto(
    Guid Id,
    string Title,
    string Content,
    Guid AuthorId,
    string? AuthorName,
    string? AuthorAvatarUrl,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    int LikeCount,
    int CommentCount,
    string? LocationName,
    double? Latitude,
    double? Longitude,
    List<MediaDto>? Media = null);

/// <summary>
/// Media item DTO
/// </summary>
public record MediaDto(
    string Url,
    string Type = "image");
