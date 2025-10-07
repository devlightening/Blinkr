using BlogService.Application.Common.Interfaces;
using BlogService.Domain.Entities;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace BlogService.Infrastructure.Repositories;

public class PostRepository : Repository<Post>, IPostRepository
{
    private readonly BlogDbContext _context;

    public PostRepository(BlogDbContext db) : base(db, db.Posts)
    {
        _context = db;
    }

    public async Task AddCommentAsync(Guid postId, PostComment comment, CancellationToken ct)
    {
        var post = await _context.Posts.FindAsync(new object[] { postId }, ct);
        if (post == null) throw new KeyNotFoundException("Post not found.");

        post.Comments.Add(comment);
        await _context.SaveChangesAsync(ct);
    }

    public async Task AddLikeAsync(Guid postId, PostLike like, CancellationToken ct)
    {
        var post = await _context.Posts.FindAsync(new object[] { postId }, ct);
        if (post == null) throw new KeyNotFoundException("Post not found.");

        post.Likes.Add(like);
        await _context.SaveChangesAsync(ct);
    }

    public async Task<IEnumerable<Post>> GetPostsByAuthorAsync(Guid authorId)
    {
        return await _context.Posts
            .Where(p => p.AuthorId == authorId)
            .Include(p => p.Media)
            .ToListAsync();
    }
}
