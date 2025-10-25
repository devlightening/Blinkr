using MediatR;
using BlogService.Application.Features.Mediatr.Comamnds.PostLocationCommands;
using BlogService.Application.Services;
using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Events;
using Microsoft.Extensions.Logging;

namespace BlogService.Application.Features.Mediatr.Handlers.PostLocationHandlers;

/// <summary>
/// Handler for updating post location
/// </summary>
public sealed class UpdatePostLocationCommandHandler : IRequestHandler<UpdatePostLocationCommand>
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

    public async Task Handle(UpdatePostLocationCommand command, CancellationToken cancellationToken)
    {
        try
        {
            // Apply privacy coarsening if needed
            var (lat, lon) = GeoPrivacy.Coarse(command.Latitude, command.Longitude, command.Precision);

            // Auto-fill location name via reverse geocoding if not provided
            var locationName = string.IsNullOrWhiteSpace(command.LocationName)
                ? await _geocodingService.TryReverseAsync(lat, lon, cancellationToken)
                : command.LocationName;

            // Load aggregate, update location, save (events will be published via decorator)
            var post = await _repository.LoadAsync<BlogService.Domain.Entities.PostAggregate>(command.PostId, cancellationToken);
            
            // Update location on aggregate (this will raise domain event)
            post.UpdateLocation(lat, lon, locationName);
            
            // Save aggregate (decorator will publish events)
            await _repository.SaveAsync(post, cancellationToken);

            _logger.LogInformation(
                "📍 PostLocationUpdated: PostId={PostId}, Lat={Lat}, Lon={Lon}, Name={Name}, Precision={Precision}",
                command.PostId, lat, lon, locationName, command.Precision);

                    }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "❌ Failed to update post location: PostId={PostId}", command.PostId);
            throw;
        }
    }
}
