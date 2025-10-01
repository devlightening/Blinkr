using BlogService.Domain.Enums;
using MediatR;


namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommands
{
    public record CreatePostCommand(
      string? Title,
      string? Content,
      Guid AuthorId,
      List<MediaItem>? Media 
  ) : IRequest<Guid>;
}
