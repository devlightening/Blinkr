using BlogService.Api.Extensions;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PostsController : ControllerBase
{
    private readonly IPostService _postService;
    private readonly ILogger<PostsController> _logger;

    public PostsController(IPostService postService, ILogger<PostsController> logger)
    {
        _postService = postService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePostDto dto)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim not found" });

        var postId = await _postService.CreatePostAsync(dto, authorId.Value);
        _logger.LogInformation("Post {PostId} created by User {UserId}", postId, authorId);
        return Ok(new { PostId = postId });
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id)
    {
        var post = await _postService.GetPostByIdAsync(id);
        if (post is null) return NotFound();
        return Ok(post);
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var posts = await _postService.GetAllPostsAsync();
        return Ok(posts);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreatePostDto dto)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim not found" });

        if (User.IsInRole("Admin"))
        {
            return Forbid("Admin users cannot update posts.");
        }

        var userOk = await _postService.UpdatePostAsync(id, dto, authorId.Value);
        if (!userOk) return Forbid();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim not found" });

        if (User.IsInRole("Admin"))
        {
            var ok = await _postService.DeletePostAsAdminAsync(id);
            if (!ok) return NotFound();
            return NoContent();
        }

        var userOk = await _postService.DeletePostAsync(id, authorId.Value);
        if (!userOk) return Forbid();
        return NoContent();
    }
}