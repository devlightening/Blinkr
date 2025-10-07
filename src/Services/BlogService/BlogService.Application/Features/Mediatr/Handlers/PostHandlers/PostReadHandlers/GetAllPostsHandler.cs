using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using BlogService.Application.Common.Interfaces;
using MediatR;

namespace BlogService.Application.Features.Mediatr.Handlers.PostHandlers.PostReadHandlers;

public class GetAllPostsHandler : IRequestHandler<GetAllPostsQuery, IEnumerable<PostResponseDto>>
{
    private readonly IPostRepository _repo;

    public GetAllPostsHandler(IPostRepository repo) => _repo = repo;

    public async Task<IEnumerable<PostResponseDto>> Handle(GetAllPostsQuery request, CancellationToken ct)
    {
        var posts = await _repo.GetAllAsync();

        return posts.Select(p => new PostResponseDto
        {
            Id = p.Id,
            Title = p.Title,
            Content = p.Content,
            AuthorId = p.AuthorId,
            CreatedAt = p.CreatedAt,
            Media = p.Media.Select(m => new PostMediaDto
            {
                Id = m.Id,
                Url = m.Url,
                Type = m.Type
            }).ToList()
        });
    }
}
