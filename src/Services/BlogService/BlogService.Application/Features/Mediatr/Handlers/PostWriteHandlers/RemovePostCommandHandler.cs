using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using MediatR;
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore; // GetByIdAsync'in kullandığı Repository'de olması gerekebilir.

namespace BlogService.Application.Features.Mediatr.Handlers.PostWriteHandlers
{
    public class RemovePostCommandHandler : IRequestHandler<RemovePostCommand, bool>
    {
        private readonly IPostRepository _repo;
        private readonly ICurrentUserService _currentUser;

        public RemovePostCommandHandler(IPostRepository repo, ICurrentUserService currentUser)
        {
            _repo = repo;
            _currentUser = currentUser;
        }

        public async Task<bool> Handle(RemovePostCommand request, CancellationToken ct)
        {
            // 1) Kimlik kontrolü
            var userId = _currentUser.UserId
                ?? throw new UnauthorizedAccessException("Silme işlemi için kimlik doğrulaması gerekli.");

            // 2) Hedef post'u bul
            // Repository'nizde GetByIdAsync metodunun Guid parametresi aldığını varsayıyoruz.
            var post = await _repo.GetByIdAsync(request.Id, ct);
            if (post is null) return false;

            // 3) Sahiplik veya Yönetici yetkisi kontrolü
            var isOwner = post.AuthorId == userId;
            // ICurrentUserService'de IsInRole metodunun mevcut olduğu varsayılır.
            var isAdmin = _currentUser.IsInRole("Admin");

            if (!isOwner && !isAdmin)
                throw new UnauthorizedAccessException("Bu gönderiyi sadece yazarı veya Yönetici silebilir.");

            // 4) Sil ve kaydet (Audit log DbContext seviyesinde otomatik düşecek)
            _repo.Remove(post);
            await _repo.SaveChangesAsync(ct);

            return true;
        }
    }
}
