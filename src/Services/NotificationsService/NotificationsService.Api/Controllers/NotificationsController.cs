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
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(IMediator mediator, ILogger<NotificationsController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userId = User.GetUserId();
        if (pageSize < 1 || pageSize > 50) pageSize = 20;
        if (page < 1) page = 1;

        _logger.LogInformation("WS-07A: GetNotifications | UserId={UserId} | Page={Page} | PageSize={PageSize}", userId, page, pageSize);

        var result = await _mediator.Send(new GetNotificationsQuery(userId, pageSize, null));
        var items = result.Item1;
        var nextCursor = result.Item2;

        _logger.LogInformation("WS-07A: GetNotifications returned {Count} items", items.Count);
        return Ok(new { items, nextCursor, page, pageSize, total = items.Count });
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount()
    {
        var userId = User.GetUserId();
        _logger.LogInformation("WS-07A: GetUnreadCount | UserId={UserId}", userId);

        var unreadCount = await _mediator.Send(new GetUnreadCountQuery(userId));

        _logger.LogInformation("WS-07A: UnreadCount for UserId={UserId} is {Count}", userId, unreadCount);
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
    public async Task<IActionResult> MarkAllRead([FromBody] MarkReadRequest? req = null)
    {
        var userId = User.GetUserId();
        var notificationIds = req?.NotificationIds ?? new List<string>();

        if (notificationIds.Count == 0)
        {
            _logger.LogInformation("WS-07A: MarkAllRead | UserId={UserId}", userId);
        }
        else
        {
            _logger.LogInformation("WS-07A: MarkRead | UserId={UserId} | NotificationCount={Count}", userId, notificationIds.Count);
        }

        await _mediator.Send(new MarkReadCommand(userId, notificationIds));
        return NoContent();
    }
}
