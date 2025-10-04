using AutoMapper;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;

namespace BlogService.Application.Mappings;

public class PostMappingProfile : Profile
{
    public PostMappingProfile()
    {
        CreateMap<CreatePostDto, CreatePostCommand>();
        CreateMap<CreatePostMediaDto, MediaItem>();
        CreateMap<BlogService.Domain.Entities.Post, PostListItemDto>();


    }
}
