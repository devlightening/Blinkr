using Blinkr.Projections.Worker.Documents;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using BlogService.Domain.Enums;
using MediatR;
using MongoDB.Driver;


namespace BlogService.Application.Features.Mediatr.Handlers.PostHandlers.PostWriteHandlers.PostReadHandlers;

public class GetPostByIdHandler : IRequestHandler<GetPostByIdQuery, PostResponseDto?>
{

    private readonly IMongoCollection<PostDocument> _postsCollection;

    public GetPostByIdHandler(IMongoDatabase database) 
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
    }

    public async Task<PostResponseDto?> Handle(GetPostByIdQuery request, CancellationToken ct)
    {
        // Veriyi MongoDB'den buluyoruz
        var postDocument = await (await _postsCollection.FindAsync(p => p.Id == request.PostId, cancellationToken: ct)).FirstOrDefaultAsync(ct);

        if (postDocument is null) return null;

        // Extract Lat/Lng from GeoJsonPoint
        double? latitude = null;
        double? longitude = null;
        
        if (postDocument.Location?.Coordinates != null)
        {
            longitude = postDocument.Location.Coordinates.Longitude;
            latitude = postDocument.Location.Coordinates.Latitude;
        }

        return new PostResponseDto
        {
            Id = postDocument.Id,
            Title = postDocument.Title,
            Content = postDocument.Content,
            AuthorId = postDocument.AuthorId,
            AuthorName = postDocument.AuthorName ?? "Unknown",
            CreatedAt = postDocument.CreatedAtUtc,
            UpdatedAt = postDocument.UpdatedAtUtc,
            LikeCount = postDocument.LikeCount,
            CommentCount = postDocument.CommentCount,
            LocationName = postDocument.LocationName,
            Latitude = latitude,
            Longitude = longitude,
            Media = postDocument.Media?.Select(m => new PostMediaDto
            {
                Id = m.Id,
                Url = m.Url,
                Type = Enum.TryParse<MediaType>(m.Type, true, out var mediaType) ? mediaType : default
            }).ToList() ?? new List<PostMediaDto>()
        };
    }
}