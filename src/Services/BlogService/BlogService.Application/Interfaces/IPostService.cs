using BlogService.Application.DTOs.PostDtos;

namespace BlogService.Application.Interfaces
{
    public interface IPostService
    {
        Task<Guid> CreatePostAsync(CreatePostDto dto, Guid authorId);
        Task<PostResponseDto?> GetPostByIdAsync(Guid id);
        Task<IEnumerable<PostResponseDto>> GetAllPostsAsync();
        Task<bool> UpdatePostAsync(Guid id, CreatePostDto dto, Guid authorId);
        Task<bool> DeletePostAsync(Guid id, Guid authorId);

        Task<bool> DeletePostAsAdminAsync(Guid id); 
    }
}
