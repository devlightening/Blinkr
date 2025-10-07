using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Domain.Entities;
using BlogService.Domain.Events;
using MediatR;

public class CreatePostCommandHandler : IRequestHandler<CreatePostCommand, Guid>
{
    private readonly IPostRepository _repo;
    private readonly ICurrentUserService _currentUser;

    public CreatePostCommandHandler(IPostRepository repo, ICurrentUserService currentUser)
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

        // Kayıt işleminden hemen önce PostCreatedEvent'i Entity'ye ekle.
        post.AddDomainEvent(new PostCreatedEvent(post.Id, authorId, post.Title!, post.Content!, DateTime.UtcNow));

        await _repo.AddAsync(post);
        // SaveChangesAsync çağrıldığında, DbContext bu olayı yakalayıp MediatR aracılığıyla yayımlayacaktır.
        await _repo.SaveChangesAsync(ct);

        return post.Id;
    }
}
