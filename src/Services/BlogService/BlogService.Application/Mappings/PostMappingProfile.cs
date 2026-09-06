
using AutoMapper;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Domain.Entities;

namespace BlogService.Application.Mappings;

public class PostMappingProfile : Profile
{
    public PostMappingProfile()
    {
        // DTO -> Command with location fields
        CreateMap<CreatePostDto, CreatePostCommand>()
            .ConstructUsing(src => new CreatePostCommand(
                src.Title,
                src.Content,
                src.Media == null ? null : src.Media.ToList(),
                src.Latitude,
                src.Longitude,
                src.AccuracyMeters,
                src.LocationName,
                null,  // AuthorName will be set from JWT claim in controller
                null,  // AuthorGender will be set from JWT claim in controller
                src.PlaceId,
                src.SignalType,
                src.SignalValue,
                src.AudienceType,
                src.IdentityDisclosure,
                src.LocationPrecision,
                src.ExpiresAt,
                src.ObservationLatitude,
                src.ObservationLongitude,
                src.ObservationAccuracyMeters
            ));
        CreateMap<CreatePostMediaDto, MediaItem>();
        CreateMap<Post, PostListItemDto>();


    }
}
