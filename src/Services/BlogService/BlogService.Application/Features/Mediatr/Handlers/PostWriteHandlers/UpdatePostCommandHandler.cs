using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using MediatR;

namespace BlogService.Application.Features.Mediatr.Handlers.PostWriteHandlers
{
    public class UpdatePostCommandHandler : IRequestHandler<UpdatePostCommand, bool>
    {
        private readonly IPostRepository _repo;
        private readonly ICurrentUserService _currentUser; 

        public UpdatePostCommandHandler(IPostRepository repo, ICurrentUserService currentUser) 
        {
            _repo = repo;
            _currentUser = currentUser;
        }

        public async Task<bool> Handle(UpdatePostCommand request, CancellationToken ct)
        {
            // 1) Kimlik kontrolü
            var userId = _currentUser.UserId
                 ?? throw new UnauthorizedAccessException("Authentication required for update operation."); 

            // 2) Hedef post'u bul (CancellationToken eklendi)
            var post = await _repo.GetByIdAsync(request.PostId, ct);
            if (post is null) return false;

            // 3) Sahiplik veya Yönetici yetkisi kontrolü
            // Yalnızca yazar veya Admin güncelleyebilir.
            var isOwner = post.AuthorId == userId;
            var isAdmin = _currentUser.IsInRole("Admin");

            if (!isOwner && !isAdmin)
                throw new UnauthorizedAccessException("Only the author or an Administrator can update this post."); 

            // 4) Güncelleme
            post.Title = request.Title;
            post.Content = request.Content;

            // 5) Kaydet (Audit log otomatik düşecek)
            _repo.Update(post);
            await _repo.SaveChangesAsync(ct);

            return true;
        }
    }
}
