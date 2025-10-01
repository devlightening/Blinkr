using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Handlers.PostWriteHandlers
{
    public class UpdatePostHandler : IRequestHandler<UpdatePostCommand, bool>
    {
        private readonly IPostRepository _repo;

        public UpdatePostHandler(IPostRepository repo) => _repo = repo;

        public async Task<bool> Handle(UpdatePostCommand request, CancellationToken ct)
        {
            var post = await _repo.GetByIdAsync(request.PostId);
            if (post is null) return false;

            if (post.AuthorId != request.AuthorId) return false;

            post.Title = request.Title;
            post.Content = request.Content;
            post.UpdatedAt = DateTime.UtcNow;

            _repo.Update(post);
            await _repo.SaveChangesAsync(ct);

            return true;
        }
    }
}