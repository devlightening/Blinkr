using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Domain.Entities;
using MediatR;

namespace BlogService.Application.Features.Posts.Handlers;

public class CreatePostHandler : IRequestHandler<CreatePostCommand, Guid>
{
    private readonly IPostRepository _repo;

    public CreatePostHandler(IPostRepository repo)
    {
        _repo = repo;
    }

    public async Task<Guid> Handle(CreatePostCommand request, CancellationToken ct)
    {
        var post = new Post
        {
            Title = request.Title,
            Content = request.Content,
            AuthorId = request.AuthorId
        };

        if (request.Media is not null && request.Media.Any())
        {
            foreach (var m in request.Media)
            {
                post.Media.Add(new PostMedia
                {
                    Url = m.Url,
                    Type = m.Type
                });
            }
        }

        await _repo.AddAsync(post);
        await _repo.SaveChangesAsync(ct);
        return post.Id;
    }
}
