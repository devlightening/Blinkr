using AutoMapper;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;

namespace BlogService.Application.Mappings;

public class PostMappingProfile : Profile
{
    public PostMappingProfile()
    {
        CreateMap<CreatePostDto, CreatePostCommand>()
            .ForMember(d => d.AuthorId, opt => opt.Ignore());
         
        CreateMap<CreatePostMediaDto, MediaItem>();
    }
}
