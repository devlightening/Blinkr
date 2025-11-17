using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotificationsService.Application.Commands;
using NotificationsService.Application.Queries;

namespace NotificationsService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly IMediator _mediator;
    public NotificationsController(IMediator mediator) => _mediator = mediator;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        // Convert page-based to cursor-based for backward compatibility
        var result = await _mediator.Send(new GetNotificationsQuery(userId, pageSize, null));
        var items = result.Item1;
        var nextCursor = result.Item2;
        return Ok(new { items, nextCursor, page, pageSize, total = items.Count });
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount()
    {
        var userId = User.GetUserId();
        var unreadCount = await _mediator.Send(new GetUnreadCountQuery(userId));
        return Ok(new { unreadCount });
    }

    public record MarkReadRequest(IReadOnlyList<string> NotificationIds);

    [HttpPost("read")]
    public async Task<IActionResult> MarkRead([FromBody] MarkReadRequest req)
    {
        var userId = User.GetUserId();
        await _mediator.Send(new MarkReadCommand(userId, req.NotificationIds));
        return NoContent();
    }
    
    [HttpPost("mark-read")]
    public async Task<IActionResult> MarkAllRead()
    {
        var userId = User.GetUserId();
        // Mark all notifications as read for the current user
        await _mediator.Send(new MarkReadCommand(userId, new List<string>())); // Empty list means all
        return NoContent();
    }
}
