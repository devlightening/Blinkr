using AutoMapper;
using BlogService.Application.Common.Interfaces;
using BlogService.Application.Common.Models;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Handlers.PostHandlers.PostWriteHandlers.PostReadHandlers
{
    public class GetPostsPagedHandler
     : IRequestHandler<GetPostsPagedQuery, PagedResult<PostListItemDto>>
    {
        private readonly IPostReadRepository _posts;

        public GetPostsPagedHandler(IPostReadRepository posts) => _posts = posts;

        public Task<PagedResult<PostListItemDto>> Handle(GetPostsPagedQuery req, CancellationToken ct)
            => _posts.GetPagedAsync(req.Page, req.PageSize, req.Search, req.OrderBy, req.Sort, ct);
    }
}
