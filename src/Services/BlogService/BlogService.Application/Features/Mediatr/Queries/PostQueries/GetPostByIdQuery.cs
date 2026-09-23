using BlogService.Application.DTOs.PostDtos;
using MediatR;

namespace BlogService.Application.Features.Mediatr.Queries.PostQueries
{
    /// <param name="RequestingUserId">
    /// The caller's user id, when authenticated, so the handler can answer whether they have this
    /// post liked right now. Null for an anonymous caller - IsLikedByCurrentUser stays false for them.
    /// </param>
    public record GetPostByIdQuery(Guid PostId, Guid? RequestingUserId = null) : IRequest<PostResponseDto?>;

}
