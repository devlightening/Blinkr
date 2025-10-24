using BlogService.Application.DTOs.PostDtos;

namespace BlogService.Application.Common.Interfaces
{
    public interface IPostReadRepository
    {
        // PostDocument is in BlogService.Api.ReadModels - this interface shouldn't reference it
        // Remove this method or create a proper DTO
        // Task<BlogService.Application.DTOs.PostDtos.PagedResult<PostDocument>> GetPostsPagedAsync(
        //     int page, int pageSize,
        //     string? search,
        //     string? orderBy,
        //     string? sort,
        //     CancellationToken cancellationToken = default);
    }
}
