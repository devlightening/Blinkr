using BlogService.Application.DTOs.PostDtos;
using MediatR;


namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommands
{
    public record CreatePostCommand(
      string Title,
      string Content,
      IList<CreatePostMediaDto>? Media
  ) : IRequest<Guid>;

}
