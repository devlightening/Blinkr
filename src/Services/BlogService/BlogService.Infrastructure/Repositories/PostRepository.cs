using BlogService.Application.Common.Interfaces;
using BlogService.Domain.Entities;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace BlogService.Infrastructure.Repositories;

public class PostRepository : Repository<Post>, IPostRepository
{
    private readonly BlogDbContext _db;

    public PostRepository(BlogDbContext db) : base(db)
    {
        _db = db;
    }

    public async Task<IEnumerable<Post>> GetPostsByAuthorAsync(Guid authorId)
    {
        return await _db.Posts
            .Where(p => p.AuthorId == authorId)
            .Include(p => p.Media)
            .ToListAsync();
    }
}
