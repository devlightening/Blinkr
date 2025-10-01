using BlogService.Api.Extensions;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PostsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<PostsController> _logger;

    public PostsController(IMediator mediator, ILogger<PostsController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePostDto dto)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim not found" });

        var postId = await _mediator.Send(new CreatePostCommand(dto.Title, dto.Content, authorId.Value, dto.Media));
        _logger.LogInformation("Post {PostId} created by User {UserId}", postId, authorId);

        return Ok(new { PostId = postId });
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id)
    {
        var post = await _mediator.Send(new GetPostByIdQuery(id));
        if (post is null) return NotFound();
        return Ok(post);
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var posts = await _mediator.Send(new GetAllPostsQuery());
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

        var success = await _mediator.Send(new UpdatePostCommand(id, dto.Title, dto.Content, authorId.Value));
        if (!success) return Forbid();

        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim not found" });

        var isAdmin = User.IsInRole("Admin");
        var success = await _mediator.Send(new RemovePostCommand(id, authorId.Value, isAdmin));

        if (!success) return Forbid();
        return NoContent();
    }
}
