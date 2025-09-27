using BlogService.Application.DTOs;
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
            AuthorId = authorId
        };

        _db.Posts.Add(post);
        await _db.SaveChangesAsync();
        return post.Id;
    }

    public async Task<PostResponseDto?> GetPostByIdAsync(Guid id)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == id);
        if (post == null) return null;

        return new PostResponseDto
        {
            Id = post.Id,
            Title = post.Title,
            Content = post.Content,
            AuthorId = post.AuthorId,
            CreatedAt = post.CreatedAt
        };
    }

    public async Task<IEnumerable<PostResponseDto>> GetAllPostsAsync()
    {
        return await _db.Posts
            .Select(p => new PostResponseDto
            {
                Id = p.Id,
                Title = p.Title,
                Content = p.Content,
                AuthorId = p.AuthorId,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<bool> UpdatePostAsync(Guid id, CreatePostDto dto, Guid authorId)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == id && p.AuthorId == authorId);
        if (post == null) return false;

        post.Title = dto.Title;
        post.Content = dto.Content;
        post.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeletePostAsync(Guid id, Guid authorId)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == id && p.AuthorId == authorId);
        if (post == null) return false;

        _db.Posts.Remove(post);
        await _db.SaveChangesAsync();
        return true;
    }
}
