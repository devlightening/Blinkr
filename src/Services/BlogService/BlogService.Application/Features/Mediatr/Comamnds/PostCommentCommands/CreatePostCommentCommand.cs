using BlogService.Domain.Events;
using MediatR;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands
{
    public record CreatePostCommentCommand(
        Guid PostId,
        string CommentText,
        Guid AuthorId,
        Guid? ParentCommentId = null,
        string? AuthorName = null,
        IReadOnlyList<MentionRef>? Mentions = null) : IRequest<Guid>;

    /// <summary>V2-4 (D-027): toggle a like on a comment; answers the state afterwards.</summary>
    public record TogglePostCommentLikeCommand(Guid PostId, Guid CommentId) : IRequest<(bool Liked, int LikeCount)>;

    /// <summary>Removes a comment (and its replies). Allowed for the comment's author or the post's author.</summary>
    public record RemovePostCommentCommand(Guid PostId, Guid CommentId, Guid RequesterId) : IRequest<Unit>;
}
