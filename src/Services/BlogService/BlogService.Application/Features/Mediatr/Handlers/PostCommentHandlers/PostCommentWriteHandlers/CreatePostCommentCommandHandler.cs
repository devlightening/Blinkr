using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands;
using BlogService.Domain.Entities;
using BlogService.Domain.Events;
using MassTransit;
using MediatR;
using Microsoft.Extensions.Logging;
using Shared.Events.Events.Blog;

public class CreatePostCommentCommandHandler : IRequestHandler<CreatePostCommentCommand, Guid>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<CreatePostCommentCommandHandler> _logger;

    public CreatePostCommentCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        IPublishEndpoint publishEndpoint,
        ILogger<CreatePostCommentCommandHandler> logger)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _publishEndpoint = publishEndpoint;
        _logger = logger;
    }

    public async Task<Guid> Handle(CreatePostCommentCommand request, CancellationToken ct)
    {
        var authorId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Authentication required.");

        var postAggregate = await _eventStoreRepo.LoadAsync<PostAggregate>(request.PostId, ct);
        if (postAggregate.Id == Guid.Empty)
        {
            throw new KeyNotFoundException($"Post with ID '{request.PostId}' not found.");
        }

        postAggregate.AddComment(authorId, request.CommentText);

        // Get the event BEFORE saving (SaveAsync clears uncommitted events)
        var commentAddedEvent = postAggregate.GetUncommittedEvents().OfType<PostCommentAddedEvent>().LastOrDefault();
        if (commentAddedEvent == null)
        {
            throw new InvalidOperationException("PostCommentAddedEvent was not generated.");
        }

        await _eventStoreRepo.SaveAsync(postAggregate, ct);

        // WS-07-SOCIAL-FIX: Publish integration event with PostOwnerId for NotificationService
        _logger.LogInformation(
            "WS-07-SOCIAL-FIX: Publishing CommentCreatedIntegrationEvent PostId={PostId}, PostOwnerId={PostOwnerId}, AuthorId={AuthorId}, CommentId={CommentId}",
            postAggregate.Id, postAggregate.AuthorId, authorId, commentAddedEvent.CommentId);

        var commentTextSnippet = request.CommentText.Length > 50 
            ? request.CommentText.Substring(0, 50) + "..." 
            : request.CommentText;

        await _publishEndpoint.Publish(new PostCommentAddedIntegrationEvent
        {
            PostId = postAggregate.Id,
            PostOwnerId = postAggregate.AuthorId,
            CommentId = commentAddedEvent.CommentId,
            CommentAuthorId = authorId,
            CommentAuthorName = "Unknown", // TODO: Get from UserService
            CommentText = commentTextSnippet,
            OccurredAtUtc = DateTime.UtcNow
        }, ct);

        return commentAddedEvent.CommentId;
    }
}
