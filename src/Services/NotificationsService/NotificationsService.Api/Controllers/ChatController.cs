using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotificationsService.Api.Filters;
using NotificationsService.Application.Commands;
using NotificationsService.Application.Queries;

namespace NotificationsService.Api.Controllers;

[ApiController]
[Route("api/chat")]
[Authorize]
[ServiceFilter(typeof(ChatExceptionFilter))]
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

    public record SignalShareRequest(Guid PostId, string? SignalType, string? SignalValue, string? Title, string? LocationName);
    public record SendMessageRequest(string? Text, string? ClientId = null, SignalShareRequest? Signal = null);
    public record ReactionRequest(string? Emoji);

    [HttpPost("conversations/{id}/messages")]
    public async Task<IActionResult> SendMessage(string id, [FromBody] SendMessageRequest req)
    {
        var userId = User.GetUserId();
        _logger.LogInformation("Chat: SendMessage | UserId={UserId} | ConversationId={ConversationId} | Kind={Kind}", userId, id, req.Signal is null ? "text" : "signal");
        var signal = req.Signal is null ? null : new SignalShareInput(req.Signal.PostId, req.Signal.SignalType, req.Signal.SignalValue, req.Signal.Title, req.Signal.LocationName);
        var message = await _mediator.Send(new SendMessageCommand(userId, id, req.Text ?? string.Empty, req.ClientId, signal));
        return Ok(message);
    }

    /// <summary>DELETE /api/chat/conversations/{id}/messages/{messageId} - take back my own message (not a snap).</summary>
    [HttpDelete("conversations/{id}/messages/{messageId}")]
    public async Task<IActionResult> Unsend(string id, string messageId) =>
        Ok(await _mediator.Send(new UnsendMessageCommand(User.GetUserId(), id, messageId)));

    /// <summary>PUT /api/chat/conversations/{id}/messages/{messageId}/reaction - { emoji } one of the fixed set, null clears.</summary>
    [HttpPut("conversations/{id}/messages/{messageId}/reaction")]
    public async Task<IActionResult> React(string id, string messageId, [FromBody] ReactionRequest req) =>
        Ok(await _mediator.Send(new ReactToMessageCommand(User.GetUserId(), id, messageId, req?.Emoji)));

    /// <summary>
    /// Sends a view-once photo or video. The body is the raw media (Content-Type = its type); the timer and an
    /// optional caption travel in the query. The media is private: only the recipient can fetch it, once.
    /// </summary>
    [HttpPost("conversations/{id}/snaps")]
    [RequestSizeLimit(MaxSnapRequestBytes)]
    public async Task<IActionResult> SendSnap(string id, [FromQuery] int durationSeconds = 5, [FromQuery] string? caption = null, CancellationToken ct = default)
    {
        var userId = User.GetUserId();
        var contentType = Request.ContentType ?? string.Empty;

        // Read the body with a hard cap so a huge upload never fills memory.
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await Request.Body.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > MaxSnapRequestBytes)
                throw new NotificationsService.Application.Exceptions.ChatValidationException("Dosya çok büyük.");
            buffer.Write(chunk, 0, read);
        }

        _logger.LogInformation("Chat: SendSnap | UserId={UserId} | ConversationId={ConversationId} | Bytes={Bytes}", userId, id, buffer.Length);
        var message = await _mediator.Send(new SendSnapCommand(userId, id, buffer.ToArray(), contentType, durationSeconds, caption), ct);
        return Ok(message);
    }

    private const int MaxSnapRequestBytes = 41 * 1024 * 1024;

    /// <summary>A recipient opens a waiting snap: it is now "opened" for good and its media can be fetched for a short window.</summary>
    [HttpPost("conversations/{id}/messages/{messageId}/open")]
    public async Task<IActionResult> OpenSnap(string id, string messageId)
    {
        var userId = User.GetUserId();
        return Ok(await _mediator.Send(new OpenSnapCommand(userId, id, messageId)));
    }

    /// <summary>The media of an opened snap, only for the recipient and only inside the viewing window. Never cached.</summary>
    [HttpGet("snaps/{messageId}/content")]
    public async Task<IActionResult> GetSnapContent(string messageId, CancellationToken ct)
    {
        var userId = User.GetUserId();
        var content = await _mediator.Send(new GetSnapContentQuery(userId, messageId), ct);
        Response.Headers.CacheControl = "no-store, no-cache, max-age=0";
        Response.Headers["Pragma"] = "no-cache";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(content.Bytes, content.ContentType);
    }

    [HttpPost("conversations/{id}/read")]
    public async Task<IActionResult> MarkRead(string id)
    {
        var userId = User.GetUserId();
        await _mediator.Send(new MarkConversationReadCommand(userId, id));
        return NoContent();
    }
}
