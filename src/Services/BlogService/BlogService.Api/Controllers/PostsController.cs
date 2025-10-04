using BlogService.Api.Extensions;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using MediatR;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BlogService.Api.Auth;
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

    [HttpPost]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> Create([FromBody] CreatePostDto dto)
    {
        var authorId = User.GetUserId();
        if (authorId is null) return Unauthorized(new { message = "UserId claim not found" });

        var cmd = _mapper.Map<CreatePostCommand>(dto);
        cmd = cmd with { AuthorId = authorId.Value }; 

        var postId = await _mediator.Send(cmd);

        _logger.LogInformation("Post {PostId} created by User {UserId}", postId, authorId);
        return Ok(new { PostId = postId });
    }
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id)
    {
        var post = await _mediator.Send(new GetPostByIdQuery(id));
        return post is null ? NotFound() : Ok(post);
    }

    [HttpGet]
    [Authorize(Policy = "api.read")]
    public async Task<IActionResult> GetAll()
    {
        var posts = await _mediator.Send(new GetAllPostsQuery());
        return Ok(posts);
    }

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

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> Remove(Guid id, [FromServices] IAuthorizationService authz)
    {
        var post = await _mediator.Send(new GetPostByIdQuery(id));
        if (post is null) return NotFound();

        // post.AuthorId'i yüklenen entity’den al
        var result = await authz.AuthorizeAsync(User, null,
            new OwnerOrAdminRequirement(post.AuthorId));
        if (!result.Succeeded) return Forbid();

        var ok = await _mediator.Send(new RemovePostCommand(id, post.AuthorId, User.IsInRole("Admin")));
        return ok ? NoContent() : Forbid();
    }

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
    