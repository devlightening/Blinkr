using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands;
using BlogService.Domain.Entities;
using BlogService.Domain.Events;
using MediatR;

public class CreatePostCommentCommandHandler : IRequestHandler<CreatePostCommentCommand, Guid>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;

    public CreatePostCommentCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
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

        // NOTE: Integration event publishing moved to EventStoreToRabbitMqPublisher
        // No need to publish here - publisher will handle it automatically

        return commentAddedEvent.CommentId;
    }
}
