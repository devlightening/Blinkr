using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using BlogService.Application.Common.Interfaces;
using MediatR;

namespace BlogService.Application.Features.Mediatr.Handlers.PostHandlers.PostReadHandlers;

public class GetPostByIdHandler : IRequestHandler<GetPostByIdQuery, PostResponseDto?>
{
    private readonly IPostRepository _repo;

    public GetPostByIdHandler(IPostRepository repo) => _repo = repo;

    public async Task<PostResponseDto?> Handle(GetPostByIdQuery request, CancellationToken ct)
    {
        var post = await _repo.GetByIdAsync(request.PostId);
        if (post is null) return null;

        return new PostResponseDto
        {
            Id = post.Id,
            Title = post.Title,
            Content = post.Content,
            AuthorId = post.AuthorId,
            CreatedAt = post.CreatedAt,
            Media = post.Media.Select(m => new PostMediaDto
            {
                Id = m.Id,
                Url = m.Url,
                Type = m.Type
            }).ToList()
        };
    }
}
