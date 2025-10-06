using System.Text.Json;
using BlogService.Application.Common.Interfaces;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Domain.Entities;
using MediatR;

public class CreatePostHandler : IRequestHandler<CreatePostCommand, Guid>
{
    private readonly IPostRepository _repo;
    private readonly ICurrentUserService _currentUser;

    public CreatePostHandler(IPostRepository repo, ICurrentUserService currentUser)
    {
        _repo = repo;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreatePostCommand request, CancellationToken ct)
    {
        var authorId = _currentUser.UserId
            ?? throw new UnauthorizedAccessException("Authenticated user required.");

        var post = new Post
        {
            Title = request.Title,
            Content = request.Content,
            AuthorId = authorId
        };

        if (request.Media is not null)
        {
            foreach (var m in request.Media)
            {
                post.Media.Add(new PostMedia
                {
                    Url = m.Url,
                    Type = m.MediaType
                });
            }
        }

        await _repo.AddAsync(post);
        await _repo.SaveChangesAsync(ct); // <- otomatik audit tetiklenir (DbContext override/interceptor)

        return post.Id;
    }
}
