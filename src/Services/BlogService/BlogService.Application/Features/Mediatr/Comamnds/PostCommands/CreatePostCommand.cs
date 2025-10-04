using BlogService.Application.DTOs.PostDtos;
using BlogService.Domain.Enums;
using MediatR;


namespace BlogService.Application.Features.Mediatr.Comamnds.PostCommands
{
    public record CreatePostCommand : IRequest<Guid>
    {
        public string Title { get; init; } = default!;
        public string Content { get; init; } = default!;
        public ICollection<CreatePostMediaDto> Media { get; init; } = new List<CreatePostMediaDto>();
        public Guid AuthorId { get; init; }
    }
}
