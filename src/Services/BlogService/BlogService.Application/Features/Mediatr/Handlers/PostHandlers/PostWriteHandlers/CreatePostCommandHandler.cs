using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Application.Services;
using BlogService.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

public class CreatePostCommandHandler : IRequestHandler<CreatePostCommand, Guid>
{
    private const int MaxTitleLength = 200;
    private const int MaxContentLength = 2000;

    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly IGeocodingService _geocodingService;
    private readonly ILogger<CreatePostCommandHandler> _logger;

    public CreatePostCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        IGeocodingService geocodingService,
        ILogger<CreatePostCommandHandler> logger)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _geocodingService = geocodingService;
        _logger = logger;
    }

    public async Task<Guid> Handle(CreatePostCommand request, CancellationToken ct)
    {
        var isQuickSignal = !string.Equals(request.SignalType, "GeneralObservation", StringComparison.Ordinal)
            && !string.IsNullOrWhiteSpace(request.SignalValue);
        var title = string.IsNullOrWhiteSpace(request.Title)
            ? $"{request.SignalType}: {request.SignalValue}"
            : request.Title.Trim();
        var content = request.Content?.Trim() ?? string.Empty;

        // Validate input
        if (string.IsNullOrWhiteSpace(title))
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - Title is empty");
            throw new ArgumentException("Title is required and cannot be empty.");
        }

        if (title.Length > MaxTitleLength)
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - Title too long (Length={Length}, Max={Max})", 
                title.Length, MaxTitleLength);
            throw new ArgumentException($"Title must not exceed {MaxTitleLength} characters.");
        }

        if (!isQuickSignal && string.IsNullOrWhiteSpace(content))
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - Content is empty");
            throw new ArgumentException("Content is required and cannot be empty.");
        }

        if (content.Length > MaxContentLength)
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - Content too long (Length={Length}, Max={Max})", 
                content.Length, MaxContentLength);
            throw new ArgumentException($"Content must not exceed {MaxContentLength} characters.");
        }

        // Get authenticated user ID - authentication is required
        var authorId = _currentUser.UserId ?? throw new UnauthorizedAccessException("User authentication required");
        var authorName = request.AuthorName ?? throw new ArgumentException("Author name is required");
        var authorGender = request.AuthorGender;
        
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
        if (!string.Equals(request.LocationPrecision, "PlaceCenter", StringComparison.Ordinal))
        {
            latitude = latitude.HasValue ? Math.Round(latitude.Value, 3, MidpointRounding.AwayFromZero) : null;
            longitude = longitude.HasValue ? Math.Round(longitude.Value, 3, MidpointRounding.AwayFromZero) : null;
        }

        var postAggregate = PostAggregate.Create(
            Guid.NewGuid(), 
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
            expiresAt);

        if (request.Media is not null)
        {
            foreach (var m in request.Media)
            {
                if (m.Url is not null)
                {
                    postAggregate.AddMedia(m.Url, m.MediaType.ToString());
                }
            }
        }

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

