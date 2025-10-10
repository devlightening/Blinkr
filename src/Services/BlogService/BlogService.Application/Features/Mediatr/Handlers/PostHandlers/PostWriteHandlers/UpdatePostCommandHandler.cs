using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Domain.Entities;
using BlogService.Domain.Events;
using MassTransit; 
using MediatR;
using Shared.Events.Events.Blog; // YENİ EKLENDİ

public class UpdatePostCommandHandler : IRequestHandler<UpdatePostCommand, bool>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly IPublishEndpoint _publishEndpoint; // YENİ EKLENDİ

    public UpdatePostCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        IPublishEndpoint publishEndpoint) // YENİ EKLENDİ
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _publishEndpoint = publishEndpoint; // YENİ EKLENDİ
    }

    public async Task<bool> Handle(UpdatePostCommand request, CancellationToken ct)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Authentication required.");

        var post = await _eventStoreRepo.LoadAsync<PostAggregate>(request.PostId, ct);
        if (post.Id == Guid.Empty)
        {
            return false;
        }

        var isOwner = post.AuthorId == userId;
        var isAdmin = _currentUser.IsInRole("Admin");
        if (!isOwner && !isAdmin)
        {
            throw new UnauthorizedAccessException("Only the author or an Admin can update this post.");
        }

        post.UpdateContent(request.Title, request.Content);
        await _eventStoreRepo.SaveAsync(post, ct);

        await _publishEndpoint.Publish(new PostContentUpdatedIntegrationEvent
        {
            PostId = post.Id,
            NewTitle = request.Title,
            NewContent = request.Content
        }, ct);

        return true;
    }
}
