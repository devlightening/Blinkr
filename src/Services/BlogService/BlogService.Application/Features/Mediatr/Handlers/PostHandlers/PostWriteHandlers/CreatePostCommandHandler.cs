using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Application.Services;
using BlogService.Domain.Entities;
using BlogService.Domain.Events;
using MediatR;
using Microsoft.Extensions.Logging;

public class CreatePostCommandHandler : IRequestHandler<CreatePostCommand, Guid>
{
    private const int MaxTitleLength = 200;
    private const int MaxContentLength = 2000;

    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly IGeocodingService _geocodingService;
    private readonly IPlaceLookupService _placeLookupService;
    private readonly IPlaceProximityPolicy _placeProximityPolicy;
    private readonly IMediaAttachmentService _mediaAttachmentService;
    private readonly ILogger<CreatePostCommandHandler> _logger;

    public CreatePostCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        IGeocodingService geocodingService,
        IPlaceLookupService placeLookupService,
        IPlaceProximityPolicy placeProximityPolicy,
        IMediaAttachmentService mediaAttachmentService,
        ILogger<CreatePostCommandHandler> logger)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _geocodingService = geocodingService;
        _placeLookupService = placeLookupService;
        _placeProximityPolicy = placeProximityPolicy;
        _mediaAttachmentService = mediaAttachmentService;
        _logger = logger;
    }

    public async Task<Guid> Handle(CreatePostCommand request, CancellationToken ct)
    {
        var isQuickSignal = !string.Equals(request.SignalType, "GeneralObservation", StringComparison.Ordinal)
            && !string.IsNullOrWhiteSpace(request.SignalValue);
        var title = string.IsNullOrWhiteSpace(request.Title)
            ? (isQuickSignal ? $"{request.SignalType}: {request.SignalValue}" : "Taze içerik")
            : request.Title.Trim();
        var content = request.Content?.Trim() ?? string.Empty;
        var requestedMediaIds = request.Media?
            .Where(m => m.MediaId.HasValue)
            .Select(m => m.MediaId!.Value)
            .ToArray() ?? Array.Empty<Guid>();
        var hasSignal = isQuickSignal;
        var hasText = !string.IsNullOrWhiteSpace(request.Title) || !string.IsNullOrWhiteSpace(content);
        var hasMedia = requestedMediaIds.Length > 0;

        // Validate input
        if (!hasSignal && !hasText && !hasMedia)
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - empty payload");
            throw new ArgumentException("Post must contain signal, text, or media.");
        }

        if (title.Length > MaxTitleLength)
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - Title too long (Length={Length}, Max={Max})", 
                title.Length, MaxTitleLength);
            throw new ArgumentException($"Title must not exceed {MaxTitleLength} characters.");
        }

        if (content.Length > MaxContentLength)
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - Content too long (Length={Length}, Max={Max})", 
                content.Length, MaxContentLength);
            throw new ArgumentException($"Content must not exceed {MaxContentLength} characters.");
        }

        if (request.Media?.Any(m => !m.MediaId.HasValue) == true)
        {
            throw new ArgumentException("Media attachments must reference a prepared mediaId.");
        }

        // Get authenticated user ID - authentication is required
        var authorId = _currentUser.UserId ?? throw new UnauthorizedAccessException("User authentication required");
        var authorName = request.AuthorName ?? throw new ArgumentException("Author name is required");
        var authorGender = request.AuthorGender;

        PlaceLookupResult? place = null;
        if (request.PlaceId.HasValue)
        {
            place = await _placeLookupService.GetAsync(request.PlaceId.Value, ct);
            if (place is null)
            {
                throw new ArgumentException("PlaceId does not reference an active place.");
            }

            var proximity = _placeProximityPolicy.Evaluate(new PlaceProximityRequest(
                request.SignalType,
                place.Latitude,
                place.Longitude,
                request.ObservationLatitude,
                request.ObservationLongitude,
                request.ObservationAccuracyMeters));
            _logger.LogInformation(
                "[Blinkr Publish] anchorType=PLACE placeId={PlaceId} distanceMeters={DistanceMeters} proximityAllowed={ProximityAllowed}",
                request.PlaceId,
                proximity.DistanceMeters.HasValue ? Math.Round(proximity.DistanceMeters.Value) : null,
                proximity.IsAllowed);
            if (!proximity.IsAllowed)
            {
                throw new PlaceProximityException("Bu yer için anlık sinyal bırakmak için mekana daha yakın olmalısın.");
            }
        }
        
        // Auto-fill location name via reverse geocoding if not provided and coordinates are available
        var locationName = request.LocationName;
        if (string.IsNullOrWhiteSpace(locationName) && request.Latitude.HasValue && request.Longitude.HasValue)
        {
            try
            {
                _logger.LogDebug("🌍 Auto-geocoding location for lat={Lat}, lon={Lon}", request.Latitude.Value, request.Longitude.Value);
                locationName = await _geocodingService.TryReverseAsync(request.Latitude.Value, request.Longitude.Value, ct);
                if (!string.IsNullOrWhiteSpace(locationName))
                {
                    _logger.LogInformation("🌍 Geocoding success: {LocationName}", locationName);
                }
                else
                {
                    _logger.LogWarning("🌍 Geocoding returned empty result for lat={Lat}, lon={Lon}", request.Latitude.Value, request.Longitude.Value);
                }
            }
            catch (Exception geocodingEx)
            {
                _logger.LogWarning(geocodingEx, "🌍 Geocoding failed for lat={Lat}, lon={Lon}, continuing without location name", 
                    request.Latitude.Value, request.Longitude.Value);
                // Continue without location name - don't fail post creation
            }
        }
        
        var expiresAt = request.ExpiresAt ?? GetDefaultExpiry(request.SignalType);
        var latitude = request.Latitude;
        var longitude = request.Longitude;
        if (place is not null && string.Equals(request.LocationPrecision, "PlaceCenter", StringComparison.Ordinal))
        {
            latitude = place.Latitude;
            longitude = place.Longitude;
            locationName = string.IsNullOrWhiteSpace(locationName) ? place.Name : locationName;
        }
        else if (!string.Equals(request.LocationPrecision, "PlaceCenter", StringComparison.Ordinal))
        {
            latitude = latitude.HasValue ? Math.Round(latitude.Value, 3, MidpointRounding.AwayFromZero) : null;
            longitude = longitude.HasValue ? Math.Round(longitude.Value, 3, MidpointRounding.AwayFromZero) : null;
        }

        var postId = Guid.NewGuid();
        var attachedMedia = await _mediaAttachmentService.ClaimForPostAsync(authorId, postId, requestedMediaIds, ct);
        var eventMedia = attachedMedia
            .Select(m => new PostMediaInfo(m.Url, m.MediaType.ToString(), m.MediaId, m.ContentType, m.SizeBytes, m.Width, m.Height, m.DurationSeconds, m.ThumbnailUrl))
            .ToList();

        var postAggregate = PostAggregate.Create(
            postId, 
            authorId, 
            title,
            content,
            latitude,
            longitude,
            request.AccuracyMeters,
            locationName,
            authorName,
            authorGender,
            request.PlaceId,
            request.SignalType,
            request.SignalValue,
            request.AudienceType,
            request.IdentityDisclosure,
            request.LocationPrecision,
            "Community",
            expiresAt,
            eventMedia);

        try
        {
            // Increase timeout for EventStore operations (60 seconds)
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(60));
            
            await _eventStoreRepo.SaveAsync(postAggregate, cts.Token);
        }
        catch (OperationCanceledException ex)
        {
            _logger.LogError(ex, "WS-06: EventStore operation timeout for PostId={PostId}", postAggregate.Id);
            throw new InvalidOperationException("Post creation timed out. EventStore is not responding. Please try again.", ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WS-06: EventStore error for PostId={PostId}", postAggregate.Id);
            throw;
        }

        _logger.LogInformation("WS-06: PostCreated | PostId={PostId} | AuthorId={AuthorId} | TitleLength={TitleLength}",
            postAggregate.Id, authorId, title.Length);

        return postAggregate.Id;
    }

    private static DateTime GetDefaultExpiry(string signalType) =>
        DateTime.UtcNow.Add(signalType switch
        {
            "Crowd" or "Queue" => TimeSpan.FromHours(1),
            "TemporaryStatus" => TimeSpan.FromHours(3),
            "Event" or "Offer" => TimeSpan.FromHours(24),
            "NewOpening" => TimeSpan.FromDays(7),
            _ => TimeSpan.FromHours(24)
        });
}

