using BlogService.Application.DTOs.PostDtos;
using MediatR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Application.Features.Mediatr.Queries.PostQueries
{
    public record GetPostsPagedQuery(int Page = 1, int PageSize = 10, string? Search = null,
                                 string? OrderBy = "CreatedAt", string? Sort = "desc")
    : IRequest<BlogService.Application.DTOs.PostDtos.PagedResult<PostListItemDto>>;
}
