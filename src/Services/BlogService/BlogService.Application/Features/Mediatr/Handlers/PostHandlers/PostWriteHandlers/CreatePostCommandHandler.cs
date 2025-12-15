using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

public class CreatePostCommandHandler : IRequestHandler<CreatePostCommand, Guid>
{
    private const int MaxTitleLength = 200;
    private const int MaxContentLength = 2000;

    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<CreatePostCommandHandler> _logger;

    public CreatePostCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser,
        ILogger<CreatePostCommandHandler> logger)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
        _logger = logger;
    }

    public async Task<Guid> Handle(CreatePostCommand request, CancellationToken ct)
    {
        // Validate input
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - Title is empty");
            throw new ArgumentException("Title is required and cannot be empty.");
        }

        if (request.Title.Length > MaxTitleLength)
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - Title too long (Length={Length}, Max={Max})", 
                request.Title.Length, MaxTitleLength);
            throw new ArgumentException($"Title must not exceed {MaxTitleLength} characters.");
        }

        if (string.IsNullOrWhiteSpace(request.Content))
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - Content is empty");
            throw new ArgumentException("Content is required and cannot be empty.");
        }

        if (request.Content.Length > MaxContentLength)
        {
            _logger.LogWarning("WS-06: CreatePost validation failed - Content too long (Length={Length}, Max={Max})", 
                request.Content.Length, MaxContentLength);
            throw new ArgumentException($"Content must not exceed {MaxContentLength} characters.");
        }

        // Get authenticated user ID - authentication is required
        var authorId = _currentUser.UserId ?? throw new UnauthorizedAccessException("User authentication required");
        var authorName = request.AuthorName ?? throw new ArgumentException("Author name is required");
        var authorGender = request.AuthorGender;
        
        var postAggregate = PostAggregate.Create(
            Guid.NewGuid(), 
            authorId, 
            request.Title, 
            request.Content,
            request.Latitude,
            request.Longitude,
            request.AccuracyMeters,
            request.LocationName,
            authorName,
            authorGender);

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
            postAggregate.Id, authorId, request.Title.Length);

        return postAggregate.Id;
    }
}

