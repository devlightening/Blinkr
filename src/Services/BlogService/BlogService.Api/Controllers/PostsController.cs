using AutoMapper;
using BlogService.Api.Auth;
using BlogService.Api.Extensions;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BlogService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PostsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<PostsController> _logger;
    private readonly IMapper _mapper;

    public PostsController(IMediator mediator, ILogger<PostsController> logger, IMapper mapper)
    {
        _mediator = mediator;
        _logger = logger;
        _mapper = mapper;
    }

    // CREATE
    [HttpPost]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> Create([FromBody] CreatePostDto dto)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim not found" });

        var cmd = _mapper.Map<CreatePostCommand>(dto) with { AuthorId = authorId.Value };
        var postId = await _mediator.Send(cmd);

        _logger.LogInformation("Post {PostId} created by User {UserId}", postId, authorId);
        return Ok(new { PostId = postId });
    }

    // READ BY ID
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id)
    {
        var post = await _mediator.Send(new GetPostByIdQuery(id));
        return post is null ? NotFound() : Ok(post);
    }

    // PAGED LIST (tek list endpoint)
    // GET /api/posts?page=1&pageSize=10&search=abc&orderBy=CreatedAt&sort=desc
    [HttpGet]
    [Authorize(Policy = "api.read")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? orderBy = "CreatedAt",
        [FromQuery] string? sort = "desc")
    {
        var result = await _mediator.Send(
            new GetPostsPagedQuery(page, pageSize, search, orderBy, sort)
        );
        return Ok(result);
    }

    // UPDATE
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreatePostDto dto)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim not found" });

        var post = await _mediator.Send(new GetPostByIdQuery(id));
        if (post is null) return NotFound();

        var authz = HttpContext.RequestServices.GetRequiredService<IAuthorizationService>();
        var result = await authz.AuthorizeAsync(User, null, new OwnerOrAdminRequirement(post.AuthorId));
        if (!result.Succeeded) return Forbid();

        if (User.IsInRole("Admin"))
            return Forbid("Admin users cannot update posts.");

        var success = await _mediator.Send(new UpdatePostCommand(id, dto.Title, dto.Content, authorId.Value));
        return success ? NoContent() : Forbid();
    }

    // DELETE
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> Remove(Guid id, [FromServices] IAuthorizationService authz)
    {
        var post = await _mediator.Send(new GetPostByIdQuery(id));
        if (post is null) return NotFound();

        var result = await authz.AuthorizeAsync(User, null, new OwnerOrAdminRequirement(post.AuthorId));
        if (!result.Succeeded) return Forbid();

        var ok = await _mediator.Send(new RemovePostCommand(id, post.AuthorId, User.IsInRole("Admin")));
        return ok ? NoContent() : Forbid();
    }

    // WHO AM I (debug)
    [HttpGet("WhoAmI")]
    public IActionResult WhoAmI()
    {
        var userId = User.GetUserId();
        var userName = User.Claims.FirstOrDefault(c => c.Type == "name")?.Value ?? "(none)";
        var role = User.Claims.FirstOrDefault(c =>
            c.Type == "role" ||
            c.Type == ClaimTypes.Role ||
            c.Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
        )?.Value ?? "(none)";

        return Ok(new
        {
            Authenticated = User.Identity?.IsAuthenticated ?? false,
            UserId = userId,
            UserName = userName,
            Role = role
        });
    }
}
