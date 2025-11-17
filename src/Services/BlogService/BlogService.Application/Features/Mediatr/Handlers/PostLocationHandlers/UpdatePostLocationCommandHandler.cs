using MediatR;
using BlogService.Application.Features.Mediatr.Comamnds.PostLocationCommands;
using BlogService.Application.Services;
using BlogService.Domain.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace BlogService.Application.Features.MediatR.Handlers.PostLocationHandlers;

public sealed class UpdatePostLocationCommandHandler
    : IRequestHandler<UpdatePostLocationCommand, Unit>
{
    private readonly IEventStoreRepository _repository;
    private readonly IGeocodingService _geocodingService;
    private readonly ILogger<UpdatePostLocationCommandHandler> _logger;

    public UpdatePostLocationCommandHandler(
        IEventStoreRepository repository,
        IGeocodingService geocodingService,
        ILogger<UpdatePostLocationCommandHandler> logger)
    {
        _repository = repository;
        _geocodingService = geocodingService;
        _logger = logger;
    }

    public async Task<Unit> Handle(UpdatePostLocationCommand command, CancellationToken cancellationToken)
    {
        try
        {
            var (lat, lon) = GeoPrivacy.Coarse(command.Latitude, command.Longitude, command.Precision);

            var locationName = string.IsNullOrWhiteSpace(command.LocationName)
                ? await _geocodingService.TryReverseAsync(lat, lon, cancellationToken)
                : command.LocationName;

            var post = await _repository.LoadAsync<BlogService.Domain.Entities.PostAggregate>(
                command.PostId, cancellationToken);

            post.UpdateLocation(lat, lon, locationName);
            await _repository.SaveAsync(post, cancellationToken);

            _logger.LogInformation(
                "📍 PostLocationUpdated: PostId={PostId}, Lat={Lat}, Lon={Lon}, Name={Name}, Precision={Precision}",
                command.PostId, lat, lon, locationName, command.Precision);

            return Unit.Value;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Failed to update post location: PostId={PostId}", command.PostId);
            throw;
        }
    }
}
