using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Domain.Entities;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

public class RemovePostCommandHandler : IRequestHandler<RemovePostCommand, bool>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;

    public RemovePostCommandHandler(IEventStoreRepository eventStoreRepo, ICurrentUserService currentUser)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(RemovePostCommand request, CancellationToken ct)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Authentication required.");

        var post = await _eventStoreRepo.LoadAsync<PostAggregate>(request.Id, ct);
        if (post.Id == Guid.Empty)
        {
            return false; // Post bulunamadı
        }

        var isOwner = post.AuthorId == userId;
        var isAdmin = _currentUser.IsInRole("Admin");
        if (!isOwner && !isAdmin)
        {
            throw new UnauthorizedAccessException("Only the author or an Admin can delete this post.");
        }

        post.Delete();
        await _eventStoreRepo.SaveAsync(post, ct);

        return true;
    }
}