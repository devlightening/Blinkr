using MediatR;

namespace BlogService.Application.Features.Mediatr.Comamnds.PostLocationCommands;

/// <summary>
/// Command to remove location from a post
/// </summary>
/// <param name="PostId">Post identifier</param>
public record RemovePostLocationCommand(
    Guid PostId
) : IRequest<Unit>;
