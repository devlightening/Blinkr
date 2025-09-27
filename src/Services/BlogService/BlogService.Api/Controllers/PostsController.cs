using BlogService.Application.DTOs;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BlogService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] 
public class PostsController(IPostService _postService) : ControllerBase
{

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePostDto dto)
    {
        var authorId = Guid.Parse(User.FindFirstValue("sub")!);
        var postId = await _postService.CreatePostAsync(dto, authorId);

        return CreatedAtAction(nameof(GetById), new { id = postId }, new { PostId = postId });
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
        var authorId = Guid.Parse(User.FindFirstValue("sub")!);
        var success = await _postService.UpdatePostAsync(id, dto, authorId);
        if (!success) return Unauthorized();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var authorId = Guid.Parse(User.FindFirstValue("sub")!);
        var success = await _postService.DeletePostAsync(id, authorId);
        if (!success) return Unauthorized();
        return NoContent();
    }
}
