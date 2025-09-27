using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Interfaces;
using BlogService.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PostsController : ControllerBase
{
    private readonly IPostService _postService;

    public PostsController(IPostService postService)
    {
        _postService = postService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePostDto dto)
    {
        var authorId = User.GetUserId();
        if (authorId == null) return Unauthorized("UserId claim bulunamadı");

        var postId = await _postService.CreatePostAsync(dto, authorId.Value);
        return Ok(new { PostId = postId });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var post = await _postService.GetPostByIdAsync(id);
        if (post == null) return NotFound();
        return Ok(post);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var posts = await _postService.GetAllPostsAsync();
        return Ok(posts);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreatePostDto dto)
    {
        var authorId = User.GetUserId();
        if (authorId == null) return Unauthorized("UserId claim bulunamadı");

        var success = await _postService.UpdatePostAsync(id, dto, authorId.Value);
        if (!success) return Forbid();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var authorId = User.GetUserId();
        if (authorId == null) return Unauthorized("UserId claim bulunamadı");

        var success = await _postService.DeletePostAsync(id, authorId.Value);
        if (!success) return Forbid();
        return NoContent();
    }
}
