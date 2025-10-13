using AutoMapper;
using BlogService.Application.DTOs.PostDtos; // Oluşturduğumuz DTO'lar için
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BlogService.Api.Auth; // User.GetUserId() extension metodu için
using BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands;
using BlogService.Application.Features.Mediatr.Comamnds.PostLikeCommands;
using BlogService.Api.Extensions;
using BlogService.Application.DTOs.PostCommentDtos;

namespace BlogService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PostsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IMapper _mapper;

    public PostsController(IMediator mediator, IMapper mapper)
    {
        _mediator = mediator;
        _mapper = mapper;
    }

    [HttpPost]
    [AllowAnonymous] // TEMPORARY: For testing without authentication
    // [Authorize(Policy = "api.write")]
    public async Task<IActionResult> Create([FromBody] CreatePostDto dto)
    {
        var command = _mapper.Map<CreatePostCommand>(dto);
        var postId = await _mediator.Send(command);
        return CreatedAtAction(nameof(GetById), new { id = postId }, new { PostId = postId });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePostDto dto)
    {
        // DÜZELTME: UpdatePostCommand'in beklediği AuthorId'yi ekliyoruz.
        var authorId = User.GetUserId() ?? throw new UnauthorizedAccessException();
        var command = new UpdatePostCommand(id, dto.Title, dto.Content, authorId);

        var success = await _mediator.Send(command);
        return success ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> Remove(Guid id)
    {
        var command = new RemovePostCommand(id);
        var success = await _mediator.Send(command);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("{postId:guid}/comments")]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> AddComment(Guid postId, [FromBody] AddCommentDto dto)
    {
        // DÜZELTME: CreatePostCommentCommand'in beklediği AuthorId'yi ekliyoruz.
        var authorId = User.GetUserId() ?? throw new UnauthorizedAccessException();
        var command = new CreatePostCommentCommand(postId, dto.CommentText, authorId, dto.ParentCommentId);

        var commentId = await _mediator.Send(command);
        return Ok(new { CommentId = commentId });
    }

    [HttpPost("{postId:guid}/likes")]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> AddLike(Guid postId)
    {
        // DÜZELTME: CreatePostLikeCommand'in beklediği UserId'yi ekliyoruz.
        var userId = User.GetUserId() ?? throw new UnauthorizedAccessException();
        var command = new CreatePostLikeCommand(postId);
        await _mediator.Send(command);
        return Ok();
    }

    // --- READ ENDPOINTS ---

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id)
    {
        var post = await _mediator.Send(new GetPostByIdQuery(id));
        return post is null ? NotFound() : Ok(post);
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetPaged([FromQuery] GetPostsPagedQuery query)
    {
        var result = await _mediator.Send(query);
        return Ok(result);
    }
}