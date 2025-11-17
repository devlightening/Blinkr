using MediatR;
using BlogService.Application.Features.Mediatr.Comamnds.PostLocationCommands;
using BlogService.Domain.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace BlogService.Application.Features.MediatR.Handlers.PostLocationHandlers;

public sealed class RemovePostLocationCommandHandler
    : IRequestHandler<RemovePostLocationCommand, Unit>
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

    public async Task<Unit> Handle(RemovePostLocationCommand command, CancellationToken cancellationToken)
    {
        try
        {
            var post = await _repository.LoadAsync<BlogService.Domain.Entities.PostAggregate>(
                command.PostId, cancellationToken);

            post.RemoveLocation();
            await _repository.SaveAsync(post, cancellationToken);

            _logger.LogInformation("📍 PostLocationRemoved: PostId={PostId}", command.PostId);
            return Unit.Value;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to remove post location: PostId={PostId}", command.PostId);
            throw;
        }
    }
}
