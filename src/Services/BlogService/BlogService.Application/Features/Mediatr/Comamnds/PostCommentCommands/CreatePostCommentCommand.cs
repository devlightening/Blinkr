using MediatR;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands
{
    public record CreatePostCommentCommand(
        Guid PostId,
        string CommentText,
        Guid AuthorId,
        Guid? ParentCommentId = null,
        string? AuthorName = null) : IRequest<Guid>;

    /// <summary>Removes a comment (and its replies). Allowed for the comment's author or the post's author.</summary>
    public record RemovePostCommentCommand(Guid PostId, Guid CommentId, Guid RequesterId) : IRequest<Unit>;
}
