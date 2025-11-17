using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostLikeCommands;
using BlogService.Domain.Entities;
using MassTransit;
using MediatR;
using Microsoft.Extensions.Logging;
using Shared.Events.Events.Blog;

namespace BlogService.Application.Features.Mediatr.Handlers.PostLikeHandlers.PostLikeWriteHandlers;

public class CreatePostLikeCommandHandler : IRequestHandler<CreatePostLikeCommand, Unit>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<CreatePostLikeCommandHandler> _logger;

    public CreatePostLikeCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        IPublishEndpoint publishEndpoint,
        ILogger<CreatePostLikeCommandHandler> logger)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _publishEndpoint = publishEndpoint;
        _logger = logger;
    }

    public async Task<Unit> Handle(CreatePostLikeCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Authentication required.");

        // 1) Load aggregate from event history
        var postAggregate = await _eventStoreRepo.LoadAsync<PostAggregate>(request.PostId, cancellationToken);
        if (postAggregate.Id == Guid.Empty)
            throw new KeyNotFoundException($"Post with ID '{request.PostId}' not found.");

        // WS-07-SOCIAL-FIX: Check if user already liked this post (toggle behavior)
        bool alreadyLiked = postAggregate.Likes.Any(l => l.UserId == userId);
        
        if (alreadyLiked)
        {
            _logger.LogInformation("WS-07-SOCIAL-FIX: User {UserId} is unliking post {PostId}", userId, request.PostId);
            postAggregate.UnlikePost(userId);
        }
        else
        {
            _logger.LogInformation("WS-07-SOCIAL-FIX: User {UserId} is liking post {PostId}", userId, request.PostId);
            postAggregate.AddLike(userId);
        }

        // 2) Save to EventStore
        await _eventStoreRepo.SaveAsync(postAggregate, cancellationToken);

        // 3) Publish integration event ONLY on new like (not on unlike)
        // This prevents notification spam and ensures one notification per "fresh like"
        if (!alreadyLiked)
        {
            _logger.LogInformation(
                "WS-07-SOCIAL-FIX: Publishing PostLikedIntegrationEvent PostId={PostId}, PostOwnerId={PostOwnerId}, LikerId={LikerId}",
                postAggregate.Id, postAggregate.AuthorId, userId);

            await _publishEndpoint.Publish(new PostLikedIntegrationEvent
            {
                PostId = postAggregate.Id,
                PostOwnerId = postAggregate.AuthorId,
                LikerUserId = userId,
                LikerUserName = "Unknown", // TODO: Get from UserService
                OccurredAtUtc = DateTime.UtcNow
            }, cancellationToken);
        }
        else
        {
            _logger.LogInformation(
                "WS-07-SOCIAL-FIX: Post unliked; no notification published. PostId={PostId}, UserId={UserId}",
                postAggregate.Id, userId);
        }

        return Unit.Value;
    }
}
