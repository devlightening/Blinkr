using BlogService.Application.DTOs.PostDtos;
using MediatR;


namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommands
{
    public record CreatePostCommand(
      string Title,
      string Content,
      IList<CreatePostMediaDto>? Media,
      double? Latitude = null,
      double? Longitude = null,
      double? AccuracyMeters = null,
      string? LocationName = null
  ) : IRequest<Guid>;

}
