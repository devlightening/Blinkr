using BlogService.Application.Common.Interfaces;
using BlogService.Application.Features.Mediatr.Comamnds.PostLikeCommands;
using BlogService.Domain.Entities;
using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Handlers.PostLikeHandlers.PostLikeWriteHandlers
{
    public class CreatePostLikeCommandHandler : IRequestHandler<CreatePostLikeCommand, Guid>
    {
        private readonly IPostRepository _postRepository;

        public CreatePostLikeCommandHandler(IPostRepository postRepository)
        {
            _postRepository = postRepository;
        }

        public async Task<Guid> Handle(CreatePostLikeCommand request, CancellationToken cancellationToken)
        {
            var like = new PostLike
            {
                PostId = request.PostId,
                UserId = request.UserId,
                LikedAtUtc = DateTime.UtcNow
            };

            await _postRepository.AddLikeAsync(request.PostId, like, cancellationToken);

            return like.Id;
        }
    }

}
