using BlogService.Application.DTOs.PostDtos;
using MediatR;

namespace BlogService.Application.Features.Mediatr.Queries.PostQueries
{
    public record GetPostByIdQuery(Guid PostId) : IRequest<PostResponseDto?>;

}
