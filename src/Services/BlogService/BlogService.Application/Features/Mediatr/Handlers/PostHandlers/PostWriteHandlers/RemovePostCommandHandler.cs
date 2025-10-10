using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Domain.Entities;
using MassTransit; // YENİ EKLENDİ
using MediatR;
using Shared.Events.Events.Blog; // YENİ EKLENDİ

public class RemovePostCommandHandler : IRequestHandler<RemovePostCommand, bool>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly IPublishEndpoint _publishEndpoint; // YENİ EKLENDİ

    public RemovePostCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        IPublishEndpoint publishEndpoint) // YENİ EKLENDİ
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _publishEndpoint = publishEndpoint; // YENİ EKLENDİ
    }

    public async Task<bool> Handle(RemovePostCommand request, CancellationToken ct)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Authentication required.");

        var post = await _eventStoreRepo.LoadAsync<PostAggregate>(request.Id, ct);
        if (post.Id == Guid.Empty)
        {
            return false;
        }

        var isOwner = post.AuthorId == userId;
        var isAdmin = _currentUser.IsInRole("Admin");
        if (!isOwner && !isAdmin)
        {
            throw new UnauthorizedAccessException("Only the author or an Admin can delete this post.");
        }

        post.Delete();
        await _eventStoreRepo.SaveAsync(post, ct);

        await _publishEndpoint.Publish(new PostDeletedIntegrationEvent { PostId = post.Id }, ct);

        return true;
    }
}
