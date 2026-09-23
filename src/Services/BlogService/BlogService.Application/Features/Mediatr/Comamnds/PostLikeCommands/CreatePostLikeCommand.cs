using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostLikeCommands
{
    /// <summary>Toggles the caller's like; returns true when the post is liked afterwards.</summary>
    public record CreatePostLikeCommand(Guid PostId) : IRequest<bool>;

}
