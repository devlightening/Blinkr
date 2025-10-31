using Refit;

namespace Blinkr.Mobile.Core.Api;

public interface IBlinkrApiClient
{
    // Posts
    [Get("/api/posts/nearby")]
    Task<List<PostLocationDto>> GetNearbyPosts(
        [Query] double lat,
        [Query] double lng,
        [Query] double radiusKm = 5.0);
}

// DTOs
public record PostLocationDto(
    Guid Id,
    string Title,
    string? Content,
    double Lat,
    double Lng,
    string? AuthorName,
    string? AuthorAvatarUrl,
    string? MediaUrl,
    int LikeCount,
    int CommentCount,
    DateTime CreatedAt);
