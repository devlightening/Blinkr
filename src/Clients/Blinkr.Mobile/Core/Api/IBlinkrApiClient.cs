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
    [Get("/api/query/posts/{id}")]
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
    Task<NotificationsResponse> GetNotificationsAsync(
        [Query] int page = 1,
        [Query] int pageSize = 20,
        CancellationToken ct = default);

    /// <summary>
    /// Mark notifications as read
    /// </summary>
    [Post("/api/notifications/mark-read")]
    Task MarkReadAsync([Body] MarkReadRequest? request = null, CancellationToken ct = default);
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
    double? DistanceMeters = null,
    string? Gender = null,
    string? LocationName = null);

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
/// Notifications response with items and pagination
/// </summary>
public record NotificationsResponse(
    List<NotificationDto> Items,
    string? NextCursor = null,
    int Page = 1,
    int PageSize = 20,
    int Total = 0);

/// <summary>
/// Unread notifications count response
/// </summary>
public record UnreadCountDto(
    int unreadCount);

/// <summary>
/// Notification item DTO
/// </summary>
public record NotificationDto(
    string Id,
    string Title,
    string Body,
    string? DeepLink,
    string? ImageUrl,
    string Type,
    DateTime CreatedAtUtc,
    bool IsRead,
    Guid? PostId = null,
    Guid? ActorUserId = null,
    string? ActorUserName = null);

/// <summary>
/// Mark notifications as read request
/// </summary>
public record MarkReadRequest(
    IEnumerable<string>? NotificationIds = null);
