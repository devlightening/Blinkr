using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Domain.Entities;
using MediatR;

public class CreatePostCommandHandler : IRequestHandler<CreatePostCommand, Guid>
{
    private readonly IEventStoreRepository _eventStoreRepo;
    private readonly ICurrentUserService _currentUser;

    public CreatePostCommandHandler(
        IEventStoreRepository eventStoreRepo,
        ICurrentUserService currentUser)
    {
        _eventStoreRepo = eventStoreRepo;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreatePostCommand request, CancellationToken ct)
    {
        // Get authenticated user ID - authentication is required
        var authorId = _currentUser.UserId ?? throw new UnauthorizedAccessException("User authentication required");
        var postAggregate = PostAggregate.Create(
            Guid.NewGuid(), 
            authorId, 
            request.Title, 
            request.Content,
            request.Latitude,
            request.Longitude,
            request.AccuracyMeters,
            request.LocationName);

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

      
        await _eventStoreRepo.SaveAsync(postAggregate, ct);

        return postAggregate.Id;
    }
}

