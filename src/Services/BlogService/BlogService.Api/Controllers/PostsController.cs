using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Interfaces;
using BlogService.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PostsController(IPostService _postService) : ControllerBase
{
   
    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Create([FromBody] CreatePostDto dto)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim bulunamadı" });

        var postId = await _postService.CreatePostAsync(dto, authorId.Value);
        return Ok(new { PostId = postId });
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PostResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var post = await _postService.GetPostByIdAsync(id);
        if (post is null) return NotFound();
        return Ok(post);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<PostResponseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll()
    {
        var posts = await _postService.GetAllPostsAsync();
        return Ok(posts);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreatePostDto dto)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim bulunamadı" });

        var ok = await _postService.UpdatePostAsync(id, dto, authorId.Value);
        if (!ok) return Forbid();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim bulunamadı" });

        var ok = await _postService.DeletePostAsync(id, authorId.Value);
        if (!ok) return Forbid();
        return NoContent();
    }
}
