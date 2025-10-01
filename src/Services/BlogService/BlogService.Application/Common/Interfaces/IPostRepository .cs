using BlogService.Domain.Entities;

namespace BlogService.Application.Common.Interfaces;

public interface IPostRepository : IRepository<Post>
{
    Task<IEnumerable<Post>> GetPostsByAuthorAsync(Guid authorId);
}
