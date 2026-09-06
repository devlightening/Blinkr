using AutoMapper;
using BlogService.Application.DTOs.PostDtos;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommands;
using BlogService.Application.Features.Mediatr.Queries.PostQueries;
using BlogService.Application.Services.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BlogService.Api.Auth;
using BlogService.Application.Features.Mediatr.Comamnds.PostCommentCommands;
using BlogService.Application.Features.Mediatr.Comamnds.PostLikeCommands;
using BlogService.Application.Services;
using BlogService.Api.Extensions;
using BlogService.Application.DTOs.PostCommentDtos;
using BlogService.Infrastructure.Services;
using BlogService.Infrastructure.Services.Queries;

namespace BlogService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PostsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IMapper _mapper;
    private readonly IPostQueryService _postQueryService;

    public PostsController(IMediator mediator, IMapper mapper, IPostQueryService postQueryService)
    {
        _mediator = mediator;
        _mapper = mapper;
        _postQueryService = postQueryService;
    }

    [HttpPost]
    [Authorize(Policy = "api.write")]
    public async Task<IActionResult> Create([FromBody] CreatePostDto dto)
    {
        // Get authenticated user ID - will be used by handler via ICurrentUserService
        var authorId = User.GetUserId() ?? throw new UnauthorizedAccessException("User not authenticated");
        
        // Get author name from JWT claims (required)
        var authorName = User.FindFirst("preferred_username")?.Value 
                      ?? User.FindFirst("name")?.Value 
                      ?? User.Identity?.Name 
                      ?? throw new UnauthorizedAccessException("User name not found in JWT claims");
        
        // Get author gender from JWT claims (for map pin color)
        var authorGender = User.FindFirst("gender")?.Value;
        
        // Create command with location, author name, and gender
        var command = new CreatePostCommand(
            dto.Title, 
            dto.Content, 
            dto.Media?.ToList(),
            dto.Latitude,
            dto.Longitude,
            dto.AccuracyMeters,
            dto.LocationName,
            authorName,
            authorGender,
            dto.PlaceId,
            dto.SignalType,
            dto.SignalValue,
            dto.AudienceType,
            dto.IdentityDisclosure,
            dto.LocationPrecision,
            dto.ExpiresAt,
            dto.ObservationLatitude,
            dto.ObservationLongitude,
            dto.ObservationAccuracyMeters);
        try
        {
            var postId = await _mediator.Send(command);
            var anchorType = dto.PlaceId.HasValue ? "PLACE" : "COORDINATE";
            return CreatedAtAction(nameof(GetById), new { id = postId }, new
            {
                PostId = postId,
                AnchorType = anchorType,
                dto.PlaceId,
                DisplayLatitude = anchorType == "COORDINATE" && dto.Latitude.HasValue ? Math.Round(dto.Latitude.Value, 3, MidpointRounding.AwayFromZero) : (double?)null,
                DisplayLongitude = anchorType == "COORDINATE" && dto.Longitude.HasValue ? Math.Round(dto.Longitude.Value, 3, MidpointRounding.AwayFromZero) : (double?)null,
                State = "accepted"
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = "not_found", message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "forbidden", message = ex.Message });
        }
        catch (PlaceProximityException ex)
        {
            return UnprocessableEntity(new { error = "PLACE_PROXIMITY_REQUIRED", message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = "invalid_content_request", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = "invalid_content_state", message = ex.Message });
        }
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
            // Get authenticated user ID for authorization
        var userId = User.GetUserId() ?? throw new UnauthorizedAccessException("User not authenticated");
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
        // Get authenticated user ID - will be used by handler via ICurrentUserService
        var userId = User.GetUserId() ?? throw new UnauthorizedAccessException("User not authenticated");
        var command = new CreatePostLikeCommand(postId); // UserId handled by ICurrentUserService in handler
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

    /// <summary>
    /// GET /api/posts/feed - Get paginated feed of posts with sorting
    /// </summary>
    [HttpGet("feed")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PaginatedFeedResponse), 200)]
    public async Task<IActionResult> GetFeed(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string sortBy = "newest")
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var result = await _postQueryService.GetFeedAsync(page, pageSize);

        // Apply sorting
        var items = result.Items.AsEnumerable();
        if (sortBy == "top")
        {
            items = items.OrderByDescending(p => p.LikeCount)
                         .ThenByDescending(p => p.CreatedAtUtc);
        }
        else // default "newest"
        {
            items = items.OrderByDescending(p => p.CreatedAtUtc);
        }

        var response = new PaginatedFeedResponse
        {
            Items = items.ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = result.TotalCount,
            TotalPages = (int)Math.Ceiling(result.TotalCount / (double)pageSize)
        };

        return Ok(response);
    }

    /// <summary>
    /// GET /api/posts/{id}/comments - Get paginated comments for a post
    /// </summary>
    [HttpGet("{postId:guid}/comments")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PaginatedCommentsResponse), 200)]
    public async Task<IActionResult> GetComments(
        Guid postId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 50) pageSize = 10;

        var post = await _postQueryService.GetPostByIdAsync(postId);
        if (post == null)
        {
            return NotFound(new { message = "Post not found" });
        }

        // Get comments from post's Comments array
        var allComments = post.Comments ?? new List<CommentDto>();
        var totalCount = allComments.Count;
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        // Apply pagination
        var paginatedComments = allComments
            .OrderByDescending(c => c.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var response = new PaginatedCommentsResponse
        {
            PostId = postId,
            Items = paginatedComments,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages
        };

        return Ok(response);
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetPaged([FromQuery] GetPostsPagedQuery query)
    {
        var result = await _mediator.Send(query);
        return Ok(result);
    }

    /// <summary>
    /// GET /api/posts/nearby - Lightweight endpoint for mobile map
    /// Returns minimal DTO for map markers
    /// </summary>
    [HttpGet("nearby")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(List<PostLocationDto>), 200)]
    public async Task<IActionResult> GetNearby(
        [FromQuery] double lat,
        [FromQuery] double lng,
        [FromQuery] double radiusKm = 5.0)
    {
        var query = new GetNearbyPostsQuery(lat, lng, radiusKm);
        var result = await _mediator.Send(query);
        
        // Transform to lightweight DTO for mobile
        var locationDtos = result.Items.Select(p => new PostLocationDto(
            p.Id,
            p.Title,
            ExtractLatitude(p),
            ExtractLongitude(p),
            p.MediaUrls?.FirstOrDefault(),
            p.AuthorGender  // Gender for map pin color
        )).ToList();
        
        return Ok(locationDtos);
    }
    
    // Helper methods to extract lat/lng from PostListDto
    private static double ExtractLatitude(PostListDto post)
    {
        return post.Latitude ?? 0;
    }
    
    private static double ExtractLongitude(PostListDto post)
    {
        return post.Longitude ?? 0;
    }
}
