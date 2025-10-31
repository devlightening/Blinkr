using BlogService.Application.DTOs.PostDtos;
using MediatR;

namespace BlogService.Application.Features.Mediatr.Queries.PostQueries;

public record GetNearbyPostsQuery(
    double Lat,
    double Lng,
    double RadiusKm = 5.0
) : IRequest<PagedResult<PostListDto>>;