using AutoMapper;
using BlogService.Application.Common.Interfaces;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Handlers.PostHandlers.PostWriteHandlers.PostReadHandlers
{
    public class GetPostsPagedHandler 
     : IRequestHandler<GetPostsPagedQuery, BlogService.Application.DTOs.PostDtos.PagedResult<PostListItemDto>>
    {
        // TODO: Implement with proper service
        // private readonly IPostReadRepository _posts;

        // public GetPostsPagedHandler(IPostReadRepository posts) => _posts = posts;

        public Task<BlogService.Application.DTOs.PostDtos.PagedResult<PostListItemDto>> Handle(GetPostsPagedQuery req, CancellationToken ct)
        {
            // TODO: Implement proper handler
            return Task.FromResult(new BlogService.Application.DTOs.PostDtos.PagedResult<PostListItemDto>(
                new List<PostListItemDto>(), 0, req.Page, req.PageSize));
        }
    }
}
