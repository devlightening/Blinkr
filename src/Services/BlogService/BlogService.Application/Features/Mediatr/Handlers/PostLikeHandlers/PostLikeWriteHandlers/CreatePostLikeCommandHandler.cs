using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostLikeCommands;
using BlogService.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;
using FluentValidation;

namespace BlogService.Application.Features.Mediatr.Handlers.PostLikeHandlers.PostLikeWriteHandlers;

public class CreatePostLikeCommandHandler : IRequestHandler<CreatePostLikeCommand, Unit>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<CreatePostLikeCommandHandler> _logger;

    public CreatePostLikeCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        ILogger<CreatePostLikeCommandHandler> logger)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<Unit> Handle(CreatePostLikeCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Authentication required.");

        // Load aggregate from EventStore (source of truth)
        var postAggregate = await _eventStoreRepo.LoadAsync<PostAggregate>(request.PostId, cancellationToken);
        if (postAggregate.Id == Guid.Empty)
        {
            _logger.LogWarning("WS-06: PostLike validation failed - Post not found (PostId={PostId})", request.PostId);
            throw new KeyNotFoundException($"Post with ID '{request.PostId}' not found.");
        }

        // Prevent self-like
        if (postAggregate.AuthorId == userId)
        {
            _logger.LogWarning("WS-06: PostLike validation failed - Cannot like own post (PostId={PostId}, UserId={UserId})",
                request.PostId, userId);
            throw new ValidationException("You cannot like your own post.");
        }

        // Check if user already liked this post (toggle behavior from EventStore)
        bool alreadyLiked = postAggregate.Likes.Any(x => x.UserId == userId);

        _logger.LogInformation(
            "WS-06: PostLike toggle check | PostId={PostId} | UserId={UserId} | AlreadyLiked={AlreadyLiked}",
            postAggregate.Id, userId, alreadyLiked);

        // Apply appropriate domain event
        if (!alreadyLiked)
        {
            _logger.LogInformation(
                "WS-06: PostLiked | PostId={PostId} | UserId={UserId} | Action=Like",
                request.PostId, userId);
            postAggregate.AddLike(userId);
        }
        else
        {
            _logger.LogInformation(
                "WS-06: PostUnliked | PostId={PostId} | UserId={UserId} | Action=Unlike",
                request.PostId, userId);
            postAggregate.UnlikePost(userId);
        }

        // Persist to EventStore
        // EventStorePublishingDecorator will publish PostLikedIntegrationEvent or PostUnlikedIntegrationEvent
        await _eventStoreRepo.SaveAsync(postAggregate, cancellationToken);

        return Unit.Value;
    }
}
