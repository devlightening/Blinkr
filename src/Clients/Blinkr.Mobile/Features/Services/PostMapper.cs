using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features.Services;

public class PostMapper : IPostMapper
{
    public PostItem MapToPostItem(PostListDto dto)
    {
        return new PostItem
        {
            Id = dto.Id,
            AuthorName = dto.AuthorName ?? "Anonim",
            LocationName = dto.LocationName ?? "Bilinmeyen Konum",
            Distance = dto.DistanceMeters.HasValue ? FormatDistance(dto.DistanceMeters.Value) : "",
            Title = dto.Title,
            Content = dto.Content,
            LikeCount = dto.LikeCount,
            CommentCount = dto.CommentCount,
            CreatedAtUtc = dto.CreatedAt
        };
    }

    private static string FormatDistance(double meters)
    {
        return meters < 1000 
            ? $"{(int)meters} m" 
            : $"{meters / 1000:F1} km";
    }
}
