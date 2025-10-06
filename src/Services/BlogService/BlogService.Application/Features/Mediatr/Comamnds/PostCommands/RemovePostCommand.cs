using MediatR;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommands
{
    public record RemovePostCommand(Guid Id) : IRequest<bool>;
}
