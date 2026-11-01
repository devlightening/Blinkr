using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands;
using BlogService.Application.Features.Mediatr.Comamnds.PostLikeCommands;
using BlogService.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace BlogService.Application.Features.Mediatr.Handlers.PostLikeHandlers.PostLikeWriteHandlers;

/// <summary>V2-4 (D-027): one reaction per person; not on your own signal (same rule as the like).</summary>
public class SetPostReactionCommandHandler : IRequestHandler<SetPostReactionCommand, PostReactionResult>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<SetPostReactionCommandHandler> _logger;

    public SetPostReactionCommandHandler(IEventStoreRepository eventStoreRepo, ICurrentUserService currentUser, ILogger<SetPostReactionCommandHandler> logger)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<PostReactionResult> Handle(SetPostReactionCommand request, CancellationToken ct)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Authentication required.");
        var post = await _eventStoreRepo.LoadAsync<PostAggregate>(request.PostId, ct);
        if (post.Version < 0 || post.IsDeleted) throw new KeyNotFoundException($"Post with ID '{request.PostId}' not found.");
        if (post.AuthorId == userId) throw new ValidationException("You cannot react to your own post.");

        var reaction = post.SetReaction(userId, request.Reaction, request.LikerName);
        if (post.GetUncommittedEvents().Any()) await _eventStoreRepo.SaveAsync(post, ct);
        _logger.LogInformation("Reaction set | PostId={PostId} | HasReaction={HasReaction}", request.PostId, reaction is not null);
        return new PostReactionResult(reaction, post.ReactionCounts());
    }
}

/// <summary>V2-4 (D-027): toggle a comment like. Your own comment may be liked (as on Instagram).</summary>
public class TogglePostCommentLikeCommandHandler : IRequestHandler<TogglePostCommentLikeCommand, (bool Liked, int LikeCount)>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;

    public TogglePostCommentLikeCommandHandler(IEventStoreRepository eventStoreRepo, ICurrentUserService currentUser)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
    }

    public async Task<(bool Liked, int LikeCount)> Handle(TogglePostCommentLikeCommand request, CancellationToken ct)
    {
        var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Authentication required.");
        var post = await _eventStoreRepo.LoadAsync<PostAggregate>(request.PostId, ct);
        if (post.Version < 0 || post.IsDeleted) throw new KeyNotFoundException($"Post with ID '{request.PostId}' not found.");
        var result = post.ToggleCommentLike(request.CommentId, userId);
        await _eventStoreRepo.SaveAsync(post, ct);
        return result;
    }
}
