using BlogService.Api.DTOs;
using BlogService.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogService.Api.Controllers;

/// <summary>
/// Read-only endpoints for querying posts from MongoDB read model
/// </summary>
[ApiController]
[Route("api/query/posts")]
[Produces("application/json")]
public class PostsQueryController : ControllerBase
{
    private readonly IPostQueryService _queryService;
    private readonly ILogger<PostsQueryController> _logger;

    public PostsQueryController(IPostQueryService queryService, ILogger<PostsQueryController> logger)
    {
        _queryService = queryService;
        _logger = logger;
    }

    /// <summary>
    /// Get paginated feed of all posts (newest first)
    /// </summary>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Page size (default: 20, max: 100)</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Paginated list of posts</returns>
    [HttpGet("feed")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PaginatedResult<PostReadDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<PostReadDto>>> GetFeed(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Getting feed. Page: {Page}, PageSize: {PageSize}", page, pageSize);
        var result = await _queryService.GetFeedAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Get a single post by ID
    /// </summary>
    /// <param name="id">Post ID</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Post details</returns>
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PostReadDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostReadDto>> GetPostById(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Getting post by ID: {PostId}", id);
        var post = await _queryService.GetPostByIdAsync(id, cancellationToken);
        
        if (post == null)
        {
            _logger.LogWarning("Post not found: {PostId}", id);
            return NotFound(new { message = $"Post with ID {id} not found" });
        }

        return Ok(post);
    }

    /// <summary>
    /// Get paginated posts by a specific author
    /// </summary>
    /// <param name="authorId">Author ID</param>
    /// <param name="page">Page number (default: 1)</param>
    /// <param name="pageSize">Page size (default: 20, max: 100)</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Paginated list of author's posts</returns>
    [HttpGet("author/{authorId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PaginatedResult<PostReadDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedResult<PostReadDto>>> GetUserPosts(
        Guid authorId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Getting posts for author: {AuthorId}. Page: {Page}, PageSize: {PageSize}", 
            authorId, page, pageSize);
        var result = await _queryService.GetUserPostsAsync(authorId, page, pageSize, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Check if a post exists
    /// </summary>
    /// <param name="id">Post ID</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Boolean indicating existence</returns>
    [HttpHead("{id:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PostExists(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var exists = await _queryService.PostExistsAsync(id, cancellationToken);
        return exists ? Ok() : NotFound();
    }
}
