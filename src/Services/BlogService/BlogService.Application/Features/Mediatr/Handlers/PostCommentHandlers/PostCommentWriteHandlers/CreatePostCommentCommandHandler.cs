using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands;
using BlogService.Domain.Entities;
using BlogService.Domain.Events;
using MediatR;
using Microsoft.Extensions.Logging;

namespace BlogService.Application.Features.Mediatr.Handlers.PostCommentHandlers.PostCommentWriteHandlers;

public class CreatePostCommentCommandHandler : IRequestHandler<CreatePostCommentCommand, Guid>
{
    private const int MaxCommentLength = 500;

    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<CreatePostCommentCommandHandler> _logger;

    public CreatePostCommentCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        ILogger<CreatePostCommentCommandHandler> logger)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<Guid> Handle(CreatePostCommentCommand request, CancellationToken ct)
    {
        // Validate comment text
        var commentText = request.CommentText?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(commentText))
        {
            _logger.LogWarning("WS-06: CreateComment validation failed - CommentText is empty");
            throw new ArgumentException("Comment text is required and cannot be empty.");
        }

        if (commentText.Length > MaxCommentLength)
        {
            _logger.LogWarning("WS-06: CreateComment validation failed - CommentText too long (Length={Length}, Max={Max})",
                commentText.Length, MaxCommentLength);
            throw new ArgumentException($"Comment must not exceed {MaxCommentLength} characters.");
        }

        var authorId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Authentication required.");

        var postAggregate = await _eventStoreRepo.LoadAsync<PostAggregate>(request.PostId, ct);
        if (postAggregate.Id == Guid.Empty)
        {
            throw new KeyNotFoundException($"Post with ID '{request.PostId}' not found.");
        }

        postAggregate.AddComment(authorId, commentText);

        // Get the event BEFORE saving (SaveAsync clears uncommitted events)
        var commentAddedEvent = postAggregate.GetUncommittedEvents().OfType<PostCommentAddedEvent>().LastOrDefault();
        if (commentAddedEvent == null)
        {
            throw new InvalidOperationException("PostCommentAddedEvent was not generated.");
        }

        // Persist to EventStore
        // EventStoreToRabbitMqPublisher publishes the integration event after the domain event is persisted.
        await _eventStoreRepo.SaveAsync(postAggregate, ct);

        _logger.LogInformation(
            "WS-06: CommentCreated | PostId={PostId} | CommentId={CommentId} | UserId={UserId} | TextLength={TextLength}",
            request.PostId, commentAddedEvent.CommentId, authorId, commentText.Length);

        return commentAddedEvent.CommentId;
    }
}
