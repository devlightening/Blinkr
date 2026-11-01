using System.Net;
using System.Text.Json;

namespace BlogService.Api.Middlewares;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next; _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try { await _next(context); }
        catch (UnauthorizedAccessException ex) when (!context.Response.HasStarted)
        {
            // A handler refused the caller (e.g. editing someone else's post): 403, not a server error (Faz 10 P10.9).
            _logger.LogWarning("Forbidden: {Reason}. TraceId: {TraceId}", ex.Message, context.TraceIdentifier);
            context.Response.Clear();
            context.Response.StatusCode = (int)HttpStatusCode.Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new { code = "FORBIDDEN", message = "Bu işlem için yetkin yok.", traceId = context.TraceIdentifier }));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception. TraceId: {TraceId}", context.TraceIdentifier);
            if (context.Response.HasStarted) throw;

            var dependencyUnavailable = ex is Grpc.Core.RpcException
            {
                StatusCode: Grpc.Core.StatusCode.DeadlineExceeded or Grpc.Core.StatusCode.Unavailable
            };
            var statusCode = dependencyUnavailable
                ? HttpStatusCode.ServiceUnavailable
                : HttpStatusCode.InternalServerError;

            context.Response.Clear();
            context.Response.StatusCode = (int)statusCode;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                code = dependencyUnavailable ? "signal_service_unavailable" : "unexpected_error",
                message = dependencyUnavailable
                    ? "Sinyal servisine şu anda ulaşılamıyor. Lütfen kısa bir süre sonra tekrar dene."
                    : "İşlem tamamlanamadı. Lütfen tekrar dene.",
                traceId = context.TraceIdentifier
            }));
        }
    }
}
