using Refit;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Blinkr.Mobile.Core.Api;

public interface IBlinkrApiClient
{
    /// <summary>
    /// Get nearby posts with freshness metadata - NOW feed support
    /// </summary>
    [Get("/api/posts-read/nearby")]
    Task<PagedResult<PostLocationDto>> GetNearbyPosts(
        [Query] double lat,
        [Query] double lon,
        [Query] int radius = 5000,
        [Query] int? sinceMinutes = null,
        [Query] int page = 1,
        [Query] int pageSize = 20);
    
    /// <summary>
    /// Get full post detail by ID
    /// </summary>
    [Get("/api/posts/{id}")]
    Task<PostDetailDto?> GetPostById(Guid id);
}

/// <summary>
/// Notifications API client for push notifications and notification management
/// </summary>
public interface INotificationsApiClient
{
    /// <summary>
    /// Register device token for push notifications
    /// </summary>
    [Post("/api/subscriptions")]
    Task RegisterDeviceTokenAsync([Body] DeviceTokenRequest request, CancellationToken ct = default);

    /// <summary>
    /// Get unread notifications count
    /// </summary>
    [Get("/api/notifications/unread-count")]
    Task<UnreadCountDto> GetUnreadCountAsync(CancellationToken ct = default);

    /// <summary>
    /// Get paginated notifications list
    /// </summary>
    [Get("/api/notifications")]
    Task<PagedResult<NotificationDto>> GetNotificationsAsync(
        [Query] int page = 1,
        [Query] int pageSize = 20,
        CancellationToken ct = default);

    /// <summary>
    /// Mark notifications as read
    /// </summary>
    [Post("/api/notifications/mark-read")]
    Task MarkReadAsync([Body] MarkReadRequest request, CancellationToken ct = default);
}

// DTOs
/// <summary>
/// Lightweight DTO for map markers with freshness metadata
/// </summary>
public record PostLocationDto(
    Guid Id,
    string Title,
    double? Latitude,
    double? Longitude,
    DateTime CreatedAtUtc,
    int? FreshnessSec = null,
    bool IsLive = false,
    string? MediaUrl = null,
    double? DistanceMeters = null);

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

// Notification DTOs
/// <summary>
/// Device token registration request
/// </summary>
public record DeviceTokenRequest(
    string DeviceToken,
    string Platform);

/// <summary>
/// Unread notifications count response
/// </summary>
public record UnreadCountDto(
    int Count);

/// <summary>
/// Notification item DTO
/// </summary>
public record NotificationDto(
    string Id,
    string Type,
    string Title,
    string Body,
    string? DeepLink,
    DateTime CreatedAtUtc,
    bool IsRead);

/// <summary>
/// Mark notifications as read request
/// </summary>
public record MarkReadRequest(
    IEnumerable<string> NotificationIds);
