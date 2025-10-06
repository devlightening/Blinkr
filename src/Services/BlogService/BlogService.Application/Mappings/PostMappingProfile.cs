
using AutoMapper;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Domain.Entities;

namespace BlogService.Application.Mappings;

public class PostMappingProfile : Profile
{
    public PostMappingProfile()
    {
        // DTO -> Command (AuthorId yok)
        CreateMap<CreatePostDto, CreatePostCommand>()
            .ConstructUsing(src => new CreatePostCommand(
                src.Title,
                src.Content,
                src.Media == null ? null : src.Media.ToList()
            ));
        CreateMap<CreatePostMediaDto, MediaItem>();
        CreateMap<Post, PostListItemDto>();


    }
}
