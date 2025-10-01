using MediatR;
using BlogService.Application.DTOs.PostDtos;

namespace BlogService.Application.Features.Mediatr.Queries.PostQueries
{
    public record GetAllPostsQuery() : IRequest<IEnumerable<PostResponseDto>>;
}
