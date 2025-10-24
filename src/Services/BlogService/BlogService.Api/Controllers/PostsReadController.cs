using BlogService.Api.Services;
using BlogService.Application.DTOs.PostDtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace BlogService.Api.Controllers;

/// <summary>
/// Read-only endpoints for posts (queries)
/// </summary>
[ApiController]
[Route("api/posts-read")]
[Produces("application/json")]
[AllowAnonymous] // Read operations are public
public class PostsReadController : ControllerBase
{
    private readonly IPostQueryService _queryService;
    private readonly ILogger<PostsReadController> _logger;

    public PostsReadController(IPostQueryService queryService, ILogger<PostsReadController> logger)
    {
        _queryService = queryService;
        _logger = logger;
    }

    /// <summary>
    /// Get paginated list of posts with filtering and search
    /// </summary>
    /// <param name="page">Page number (1-based, default: 1)</param>
    /// <param name="pageSize">Items per page (1-100, default: 20)</param>
    /// <param name="authorId">Filter by author ID</param>
    /// <param name="q">Search in title and content</param>
    /// <param name="sort">Sort order: createdAt:desc, createdAt:asc, likeCount:desc (default: createdAt:desc)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Paginated list of posts</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<PostListDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetPosts(
        [FromQuery, Range(1, 1000)] int page = 1,
        [FromQuery, Range(1, 100)] int pageSize = 20,
        [FromQuery] string? authorId = null,
        [FromQuery] string? q = null,
        [FromQuery] string sort = "createdAt:desc",
        CancellationToken ct = default)
    {
        try
        {
            // Validate and clamp parameters
            page = Math.Clamp(page, 1, 1000);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = new PostQuery
            {
                Page = page,
                PageSize = pageSize,
                AuthorId = authorId,
                Search = q,
                Sort = sort
            };

            var result = await _queryService.QueryPostsAsync(query, ct);

            // Add pagination headers
            Response.Headers["X-Total-Count"] = result.Total.ToString();
            Response.Headers["X-Page"] = result.Page.ToString();
            Response.Headers["X-Page-Size"] = result.PageSize.ToString();
            Response.Headers["X-Total-Pages"] = result.TotalPages.ToString();
            Response.Headers["X-Has-Next"] = result.HasNext.ToString().ToLower();
            Response.Headers["X-Has-Previous"] = result.HasPrevious.ToString().ToLower();

            _logger.LogInformation("Posts query executed: Page={Page}, PageSize={PageSize}, Total={Total}, AuthorId={AuthorId}, Search={Search}",
                page, pageSize, result.Total, authorId, q);

            return Ok(result.Items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing posts query: Page={Page}, PageSize={PageSize}, AuthorId={AuthorId}, Search={Search}",
                page, pageSize, authorId, q);
            return StatusCode(500, "An error occurred while retrieving posts");
        }
    }

    /// <summary>
    /// Get a single post by ID
    /// </summary>
    /// <param name="id">Post ID</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Post details</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PostListDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        try
        {
            var post = await _queryService.GetByIdAsync(id, ct);
            
            if (post == null)
            {
                _logger.LogWarning("Post not found: {PostId}", id);
                return NotFound($"Post with ID {id} not found");
            }

            _logger.LogInformation("Post retrieved: {PostId}", id);
            return Ok(post);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving post: {PostId}", id);
            return StatusCode(500, "An error occurred while retrieving the post");
        }
    }

    /// <summary>
    /// Get posts by author
    /// </summary>
    /// <param name="authorId">Author ID</param>
    /// <param name="page">Page number (1-based, default: 1)</param>
    /// <param name="pageSize">Items per page (1-100, default: 20)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Paginated list of author's posts</returns>
    [HttpGet("author/{authorId:guid}")]
    [ProducesResponseType(typeof(IEnumerable<PostListDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetByAuthor(
        Guid authorId,
        [FromQuery, Range(1, 1000)] int page = 1,
        [FromQuery, Range(1, 100)] int pageSize = 20,
        CancellationToken ct = default)
    {
        try
        {
            // Use the main query method with author filter
            var query = new PostQuery
            {
                Page = page,
                PageSize = pageSize,
                AuthorId = authorId.ToString(),
                Sort = "createdAt:desc"
            };

            var result = await _queryService.QueryPostsAsync(query, ct);

            // Add pagination headers
            Response.Headers["X-Total-Count"] = result.Total.ToString();
            Response.Headers["X-Page"] = result.Page.ToString();
            Response.Headers["X-Page-Size"] = result.PageSize.ToString();
            Response.Headers["X-Total-Pages"] = result.TotalPages.ToString();

            _logger.LogInformation("Author posts query executed: AuthorId={AuthorId}, Page={Page}, Total={Total}",
                authorId, page, result.Total);

            return Ok(result.Items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving posts for author: {AuthorId}", authorId);
            return StatusCode(500, "An error occurred while retrieving author posts");
        }
    }
}
