using BlogService.Application.Common.Models;
using BlogService.Application.DTOs.PostDtos;

namespace BlogService.Application.Common.Interfaces
{
    public interface IPostReadRepository
    {
        Task<PagedResult<PostListItemDto>> GetPagedAsync(
            int page, int pageSize,
            string? search,
            string? orderBy,
            string? sort,
            CancellationToken ct = default);
    }
}
