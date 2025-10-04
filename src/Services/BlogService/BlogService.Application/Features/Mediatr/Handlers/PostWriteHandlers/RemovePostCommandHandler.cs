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
    public class RemovePostCommandHandler : IRequestHandler<RemovePostCommand, bool>
    {
        private readonly IPostRepository _repo;

        public RemovePostCommandHandler(IPostRepository repo) => _repo = repo;

        public async Task<bool> Handle(RemovePostCommand request, CancellationToken ct)
        {
            var post = await _repo.GetByIdAsync(request.PostId);
            if (post is null) return false;

            if (post.AuthorId != request.AuthorId && !request.IsAdmin) return false;

            _repo.Remove(post);
            await _repo.SaveChangesAsync(ct);

            return true;
        }
    }
}