using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using NotificationsService.Application.Exceptions;

namespace NotificationsService.Api.Filters;

/// <summary>
/// Maps expected chat failures to 4xx responses with the same { error, message } body the other
/// services use. Unexpected exceptions are not handled here, so they stay 500s and are logged.
/// </summary>
public sealed class ChatExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not ChatException chat) return;

        var body = new { error = chat.Code, message = chat.Message };
        context.Result = chat switch
        {
            ChatValidationException => new BadRequestObjectResult(body),
            ChatForbiddenException => new ObjectResult(body) { StatusCode = StatusCodes.Status403Forbidden },
            ChatNotFoundException => new NotFoundObjectResult(body),
            ChatGoneException => new ObjectResult(body) { StatusCode = StatusCodes.Status410Gone },
            _ => new ObjectResult(body) { StatusCode = StatusCodes.Status400BadRequest },
        };
        context.ExceptionHandled = true;
    }
}
