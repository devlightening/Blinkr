using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostLikeCommands
{
    /// <summary>Toggles the caller's like; returns true when the post is liked afterwards.</summary>
    public record CreatePostLikeCommand(Guid PostId, string? LikerName = null) : IRequest<bool>;

    /// <summary>
    /// V2-4 (D-027): set my reaction (null or the same emoji again = take it back). Answers my reaction afterwards and the
    /// counts from the aggregate, so the screen is right at once without waiting for the projection.
    /// </summary>
    public record SetPostReactionCommand(Guid PostId, string? Reaction, string? LikerName = null) : IRequest<PostReactionResult>;
    public record PostReactionResult(string? Reaction, IReadOnlyDictionary<string, int> Counts);

}
