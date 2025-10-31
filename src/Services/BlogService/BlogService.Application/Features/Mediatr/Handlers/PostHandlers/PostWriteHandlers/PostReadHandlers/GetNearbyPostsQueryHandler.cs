using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using BlogService.Application.Services.Queries;
using MediatR;

namespace BlogService.Application.Features.Mediatr.Handlers.PostHandlers.PostReadHandlers;

public class GetNearbyPostsQueryHandler : IRequestHandler<GetNearbyPostsQuery, PagedResult<PostListDto>>
{
    private readonly IPostQueryService _queryService;

    public GetNearbyPostsQueryHandler(IPostQueryService queryService)
    {
        _queryService = queryService;
    }

    public async Task<PagedResult<PostListDto>> Handle(GetNearbyPostsQuery request, CancellationToken cancellationToken)
    {
        var query = new NearbyQuery(
            Lat: request.Lat,
            Lon: request.Lng,
            RadiusMeters: (int)(request.RadiusKm * 1000), // km -> meters
            Page: 1,
            PageSize: 50
        );

        return await _queryService.GetNearbyAsync(query, cancellationToken);
    }
}