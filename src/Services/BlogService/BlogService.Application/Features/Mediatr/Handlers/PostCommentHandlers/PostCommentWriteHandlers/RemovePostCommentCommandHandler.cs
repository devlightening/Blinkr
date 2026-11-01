using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands;
using BlogService.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace BlogService.Application.Features.Mediatr.Handlers.PostCommentHandlers.PostCommentWriteHandlers;

public class RemovePostCommentCommandHandler : IRequestHandler<RemovePostCommentCommand, Unit>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ILogger<RemovePostCommentCommandHandler> _logger;

    public RemovePostCommentCommandHandler(IEventStoreRepository eventStoreRepo, ILogger<RemovePostCommentCommandHandler> logger)
    {
        _eventStoreRepo = eventStoreRepo;
        _logger = logger;
    }

    public async Task<Unit> Handle(RemovePostCommentCommand request, CancellationToken ct)
    {
        var postAggregate = await _eventStoreRepo.LoadAsync<PostAggregate>(request.PostId, ct);
        if (postAggregate.Version < 0 || postAggregate.IsDeleted) // no events = no such post (a new aggregate gets a random Id, never Guid.Empty)
        {
            throw new KeyNotFoundException($"Post with ID '{request.PostId}' not found.");
        }

        postAggregate.RemoveComment(request.CommentId, request.RequesterId);
        await _eventStoreRepo.SaveAsync(postAggregate, ct);

        _logger.LogInformation("CommentRemoved | PostId={PostId} | CommentId={CommentId}", request.PostId, request.CommentId);
        return Unit.Value;
    }
}
