using MediatR;
using BlogService.Application.Features.Mediatr.Comamnds.PostLocationCommands;
using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Events;
using Microsoft.Extensions.Logging;

namespace BlogService.Application.Features.MediatR.Handlers.PostLocationHandlers;

/// <summary>
/// Handler for removing location from a post
/// </summary>
public sealed class RemovePostLocationCommandHandler : IRequestHandler<RemovePostLocationCommand>
{
    private readonly IEventStoreRepository _repository;
    private readonly ILogger<RemovePostLocationCommandHandler> _logger;

    public RemovePostLocationCommandHandler(
        IEventStoreRepository repository,
        ILogger<RemovePostLocationCommandHandler> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task Handle(RemovePostLocationCommand command, CancellationToken cancellationToken)
    {
        try
        {
            // Load aggregate, remove location, save (events will be published via decorator)
            var post = await _repository.LoadAsync<BlogService.Domain.Entities.PostAggregate>(command.PostId, cancellationToken);
            
            // Remove location from aggregate (this will raise domain event)
            post.RemoveLocation();
            
            // Save aggregate (decorator will publish events)
            await _repository.SaveAsync(post, cancellationToken);

            _logger.LogInformation(
                "📍 PostLocationRemoved: PostId={PostId}",
                command.PostId);

                    }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "❌ Failed to remove post location: PostId={PostId}", command.PostId);
            throw;
        }
    }
}
