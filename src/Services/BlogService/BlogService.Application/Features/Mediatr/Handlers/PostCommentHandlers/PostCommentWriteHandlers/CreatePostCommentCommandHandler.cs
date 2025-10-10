using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands;
using BlogService.Domain.Entities;
using BlogService.Domain.Events;
using MassTransit;
using MediatR;
using Shared.Events.Events.Blog;

public class CreatePostCommentCommandHandler : IRequestHandler<CreatePostCommentCommand, Guid>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly IPublishEndpoint _publishEndpoint;

    public CreatePostCommentCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        IPublishEndpoint publishEndpoint)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _publishEndpoint = publishEndpoint;
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

        await _eventStoreRepo.SaveAsync(postAggregate, ct);

        var commentAddedEvent = postAggregate.GetUncommittedEvents().OfType<PostCommentAddedEvent>().Last();
        await _publishEndpoint.Publish(new PostCommentAddedIntegrationEvent
        {
            PostId = commentAddedEvent.PostId,
            CommentId = commentAddedEvent.CommentId,
            AuthorId = commentAddedEvent.AuthorId,
            CommentText = commentAddedEvent.CommentText
        }, ct);

        return commentAddedEvent.CommentId;
    }
}
