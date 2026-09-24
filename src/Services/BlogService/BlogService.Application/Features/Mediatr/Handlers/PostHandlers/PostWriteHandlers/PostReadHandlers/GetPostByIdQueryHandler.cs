using BlogService.Application.Common.ReadModels;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using BlogService.Domain.Enums;
using MediatR;
using MongoDB.Driver;


namespace BlogService.Application.Features.Mediatr.Handlers.PostHandlers.PostWriteHandlers.PostReadHandlers;

public class GetPostByIdHandler : IRequestHandler<GetPostByIdQuery, PostResponseDto?>
{

    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly IMongoDatabase _database;

    public GetPostByIdHandler(IMongoDatabase database) 
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _database = database;
    }

    public async Task<PostResponseDto?> Handle(GetPostByIdQuery request, CancellationToken ct)
    {
        // Veriyi MongoDB'den buluyoruz
        var postDocument = await (await _postsCollection.FindAsync(p => p.Id == request.PostId, cancellationToken: ct)).FirstOrDefaultAsync(ct);

        if (postDocument is null) return null;
        if ((!string.IsNullOrWhiteSpace(postDocument.AudienceType) && postDocument.AudienceType != "Public") ||
            (postDocument.ExpiresAt.HasValue && postDocument.ExpiresAt <= DateTime.UtcNow))
        {
            return null;
        }

        // Extract Lat/Lng from GeoJsonPoint
        double? latitude = null;
        double? longitude = null;
        
        if (postDocument.Location?.Coordinates != null)
        {
            longitude = postDocument.Location.Coordinates.Longitude;
            latitude = postDocument.Location.Coordinates.Latitude;
            if (postDocument.LocationPrecision != "PlaceCenter" || !postDocument.PlaceId.HasValue)
            {
                longitude = Math.Round(longitude.Value, 3, MidpointRounding.AwayFromZero);
                latitude = Math.Round(latitude.Value, 3, MidpointRounding.AwayFromZero);
            }
        }

        var anonymous = postDocument.IdentityDisclosure == "AnonymousMap";
        var isMine = request.RequestingUserId.HasValue && request.RequestingUserId.Value == postDocument.AuthorId;
        // Only the author sees how many people looked at their card (plan-devam C12).
        int? viewCount = isMine
            ? (int)await _database.GetCollection<MongoDB.Bson.BsonDocument>("post_views").CountDocumentsAsync(new MongoDB.Bson.BsonDocument("PostId", postDocument.Id.ToString()), cancellationToken: ct)
            : null;

        return new PostResponseDto
        {
            Id = postDocument.Id,
            Title = postDocument.Title,
            Content = postDocument.Content,
            AuthorId = anonymous ? Guid.Empty : postDocument.AuthorId,
            AuthorName = anonymous ? "Topluluk üyesi" : postDocument.AuthorName ?? "Unknown",
            CreatedAt = postDocument.CreatedAtUtc,
            UpdatedAt = postDocument.UpdatedAtUtc,
            LikeCount = postDocument.LikeCount,
            CommentCount = postDocument.CommentCount,
            IsLikedByCurrentUser = request.RequestingUserId.HasValue
                && (postDocument.LikedByUserIds?.Contains(request.RequestingUserId.Value) ?? false),
            LocationName = postDocument.LocationName,
            Latitude = latitude,
            Longitude = longitude,
            PlaceId = postDocument.PlaceId,
            SignalType = postDocument.SignalType,
            SignalValue = postDocument.SignalValue,
            AudienceType = postDocument.AudienceType,
            IdentityDisclosure = postDocument.IdentityDisclosure,
            LocationPrecision = postDocument.LocationPrecision,
            SourceType = postDocument.SourceType,
            ExpiresAt = postDocument.ExpiresAt,
            PublicationTrust = postDocument.PublicationTrust,
            FromGallery = postDocument.FromGallery,
            IsMine = isMine,
            ViewCount = viewCount,
            Media = postDocument.Media?.Select(m => new PostMediaDto
            {
                Id = m.Id,
                Url = m.Url,
                ThumbnailUrl = m.ThumbnailUrl,
                Width = m.Width,
                Height = m.Height,
                Type = Enum.TryParse<MediaType>(m.Type, true, out var mediaType) ? mediaType : default
            }).ToList() ?? new List<PostMediaDto>()
        };
    }
}
