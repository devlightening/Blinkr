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
