using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostLikeCommands;
using BlogService.Domain.Entities;
using MassTransit;
using MediatR;
using Shared.Events.Events.Blog;

namespace BlogService.Application.Features.Mediatr.Handlers.PostLikeHandlers.PostLikeWriteHandlers;

public class CreatePostLikeCommandHandler : IRequestHandler<CreatePostLikeCommand>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly IPublishEndpoint _publishEndpoint;

    public CreatePostLikeCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        IPublishEndpoint publishEndpoint)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _publishEndpoint = publishEndpoint;
    }

    public async Task Handle(CreatePostLikeCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Authentication required.");

        // 1. Aggregate'i olay geçmişinden yükle
        var postAggregate = await _eventStoreRepo.LoadAsync<PostAggregate>(request.PostId, cancellationToken);
        if (postAggregate.Id == Guid.Empty)
        {
            throw new KeyNotFoundException($"Post with ID '{request.PostId}' not found.");
        }

        // 2. İşi Aggregate'e devret (PostLikedEvent burada yaratılır)
        postAggregate.AddLike(userId);

        // 3. Yeni olayları Event Store'a kaydet
        await _eventStoreRepo.SaveAsync(postAggregate, cancellationToken);

        // 4. Integration Event'i Outbox'a yayınla
        await _publishEndpoint.Publish(new PostLikedIntegrationEvent
        {
            PostId = postAggregate.Id,
            UserId = userId
        }, cancellationToken);
    }
}