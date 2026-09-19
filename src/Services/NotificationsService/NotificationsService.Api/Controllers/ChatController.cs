using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotificationsService.Application.Commands;
using NotificationsService.Application.Queries;

namespace NotificationsService.Api.Controllers;

[ApiController]
[Route("api/chat")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<ChatController> _logger;

    public ChatController(IMediator mediator, ILogger<ChatController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> ListConversations()
    {
        var userId = User.GetUserId();
        var items = await _mediator.Send(new ListConversationsQuery(userId));
        return Ok(new { items });
    }

    public record StartConversationRequest(Guid TargetUserId);

    [HttpPost("conversations")]
    public async Task<IActionResult> StartConversation([FromBody] StartConversationRequest req)
    {
        var userId = User.GetUserId();
        var conversation = await _mediator.Send(new StartOrGetConversationCommand(userId, req.TargetUserId));
        return Ok(conversation);
    }

    [HttpGet("conversations/{id}/messages")]
    public async Task<IActionResult> GetMessages(string id, [FromQuery] int limit = 30, [FromQuery] string? before = null)
    {
        var userId = User.GetUserId();
        var (items, nextCursor) = await _mediator.Send(new GetMessagesQuery(userId, id, limit, before));
        return Ok(new { items, nextCursor });
    }

    public record SendMessageRequest(string Text);

    [HttpPost("conversations/{id}/messages")]
    public async Task<IActionResult> SendMessage(string id, [FromBody] SendMessageRequest req)
    {
        var userId = User.GetUserId();
        _logger.LogInformation("Chat: SendMessage | UserId={UserId} | ConversationId={ConversationId}", userId, id);
        var message = await _mediator.Send(new SendMessageCommand(userId, id, req.Text));
        return Ok(message);
    }

    [HttpPost("conversations/{id}/read")]
    public async Task<IActionResult> MarkRead(string id)
    {
        var userId = User.GetUserId();
        await _mediator.Send(new MarkConversationReadCommand(userId, id));
        return NoContent();
    }
}
