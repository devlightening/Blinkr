using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostLikeCommands
{
    public record CreatePostLikeCommand(Guid PostId, Guid UserId) : IRequest<Guid>;

}
