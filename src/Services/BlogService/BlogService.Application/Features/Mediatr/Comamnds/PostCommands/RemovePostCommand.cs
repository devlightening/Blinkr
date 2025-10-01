using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommands
{
    public record RemovePostCommand(Guid PostId,
    Guid AuthorId,
    bool IsAdmin = false
    ) : IRequest<bool>;
}
