using BlogService.Domain.Entities;

namespace BlogService.Application.Common.Interfaces;

public interface IPostRepository : IRepository<Post>
{
    Task<IEnumerable<Post>> GetPostsByAuthorAsync(Guid authorId);
    //Task<Post?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    //void Remove(Post post);
    //Task<int> SaveChangesAsync(CancellationToken ct = default);

}
