using MediatR;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands
{
    public record CreatePostCommentCommand(Guid PostId, string CommentText, Guid AuthorId, Guid? ParentCommentId = null) : IRequest<Guid>;

}
