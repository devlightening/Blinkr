using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Interfaces;
using BlogService.Domain.Entities;
using BlogService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace BlogService.Infrastructure.Services;

public class PostService : IPostService
{
    private readonly BlogDbContext _db;

    public PostService(BlogDbContext db)
    {
        _db = db;
    }

    public async Task<Guid> CreatePostAsync(CreatePostDto dto, Guid authorId)
    {
        var post = new Post
        {
            Title = dto.Title,
            Content = dto.Content,
            AuthorId = authorId,
            Media = dto.Media.Select(m => new PostMedia
            {
                Url = m.Url,
                Type = m.Type
            }).ToList() // Add Media
        };

        _db.Posts.Add(post);
        await _db.SaveChangesAsync(); // Save Changes
        return post.Id;
    }

    public async Task<PostResponseDto?> GetPostByIdAsync(Guid id)
    {
        var post = await _db.Posts
            .Include(p => p.Media) // Include Media
            .FirstOrDefaultAsync(p => p.Id == id);

        if (post is null) return null; // Post Not Found

        return MapToResponse(post);
    }

    public async Task<IEnumerable<PostResponseDto>> GetAllPostsAsync()
    {
        var posts = await _db.Posts
            .Include(p => p.Media) // Include Media
            .ToListAsync();

        return posts.Select(MapToResponse);
    }

    public async Task<bool> UpdatePostAsync(Guid id, CreatePostDto dto, Guid authorId)
    {
        var post = await _db.Posts
            .Include(p => p.Media) // Include Media
            .FirstOrDefaultAsync(p => p.Id == id && p.AuthorId == authorId); // Author Check

        if (post == null) return false; // Not Authorized

        post.Title = dto.Title;
        post.Content = dto.Content;
        post.UpdatedAt = DateTime.UtcNow;

        // Media Management
        _db.PostMedias.RemoveRange(post.Media); // Delete Old
        post.Media = dto.Media.Select(m => new PostMedia
        {
            Url = m.Url,
            Type = m.Type
        }).ToList(); // Add New

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeletePostAsync(Guid id, Guid authorId)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == id && p.AuthorId == authorId); // Author Check
        if (post == null) return false; // Not Found

        _db.Posts.Remove(post);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeletePostAsAdminAsync(Guid id)
    {
        var post = await _db.Posts.FindAsync(id); // Admin Delete
        if (post == null) return false; // Not Found

        _db.Posts.Remove(post);
        await _db.SaveChangesAsync();
        return true;
    }

    private static PostResponseDto MapToResponse(Post post)
    {
        // Map to DTO
        return new PostResponseDto
        {
            Id = post.Id,
            Title = post.Title,
            Content = post.Content,
            AuthorId = post.AuthorId,
            CreatedAt = post.CreatedAt,
            UpdatedAt = post.UpdatedAt,
            Media = post.Media.Select(m => new PostMediaResponseDto
            {
                Id = m.Id,
                Url = m.Url,
                MediaType = m.Type
            }).ToList()
        };
    }
}