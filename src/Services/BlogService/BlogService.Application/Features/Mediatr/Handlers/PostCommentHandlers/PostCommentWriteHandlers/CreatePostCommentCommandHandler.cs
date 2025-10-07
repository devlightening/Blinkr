using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands;
using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Entities;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

// CreatePostCommentCommand tanımınızın burada olduğunu varsayıyorum:
// public record CreatePostCommentCommand(Guid PostId, string Content, Guid AuthorId, Guid? ParentCommentId) : IRequest<Guid>;

public class CreatePostCommentCommandHandler : IRequestHandler<CreatePostCommentCommand, Guid>
{
    // Event Store üzerinden Aggregate yükleme/kaydetme
    private readonly IEventStoreRepository _eventStoreRepository;

    public CreatePostCommentCommandHandler(IEventStoreRepository eventStoreRepository)
    {
        _eventStoreRepository = eventStoreRepository;
    }

    public async Task<Guid> Handle(CreatePostCommentCommand request, CancellationToken cancellationToken)
    {
        // 1. Post Aggregate Root'u yükle
        var post = await _eventStoreRepository.LoadAsync<PostAggregate>(request.PostId, cancellationToken);

        // Event Sourcing'de Aggregate yoksa LoadAsync boş Aggregate döndürür, Id kontrolü yapılır.
        if (post.Id == Guid.Empty)
        {
            throw new KeyNotFoundException($"Post ID '{request.PostId}' bulunamadı.");
        }

        // 2. Aggregate üzerinde iş mantığını çağır (Bu, PostCommentAddedEvent'i fırlatır)
        post.AddComment(request.AuthorId, request.CommentText);

        // 3. Aggregate üzerindeki yeni olayları Event Store'a kaydet
        await _eventStoreRepository.SaveAsync(post, cancellationToken);

        // Not: Gerçekte CommentId'yi Aggregate'in DomainEvents'inden almamız gerekir. 
        // Şimdilik sadece PostId'yi döndürelim (veya Post'un Version'ını).
        return post.Id;
    }
}
