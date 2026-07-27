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
      string? LocationName = null,
      string? AuthorName = null,
      string? AuthorGender = null,
      Guid? PlaceId = null,
      string SignalType = "GeneralObservation",
      string? SignalValue = null,
      string AudienceType = "Public",
      string IdentityDisclosure = "LimitedProfile",
      string LocationPrecision = "ApproximateArea",
      DateTime? ExpiresAt = null
  ) : IRequest<Guid>;

}
