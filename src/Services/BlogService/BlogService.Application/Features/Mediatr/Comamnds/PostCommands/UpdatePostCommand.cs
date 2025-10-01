using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommands
{
    public record UpdatePostCommand(
    Guid PostId,
    string? Title,
    string? Content,
    Guid AuthorId
) : IRequest<bool>;

}
