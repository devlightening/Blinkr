using BlogService.Application.DTOs.PostCommentDtos;
using MediatR;

namespace BlogService.Application.Features.Mediatr.Queries.PostQueries
{
    /// <param name="Sort">"newest" (default) or "oldest" - applies to top-level comments; replies are always oldest first.</param>
    public record GetPostCommentsQuery(Guid PostId, Guid? RequestingUserId, int Page, int PageSize, string Sort)
        : IRequest<PostCommentThreadPageDto?>;
}
