using MediatR;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommands
{
    public record UpdatePostCommand(
    Guid PostId,
    string? Title,
    string? Content,
    Guid AuthorId
) : IRequest<bool>;

}
