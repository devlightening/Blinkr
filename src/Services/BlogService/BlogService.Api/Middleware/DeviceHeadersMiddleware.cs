using System.Diagnostics;

namespace BlogService.Api.Middleware;

public class DeviceHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<DeviceHeadersMiddleware> _logger;

    public DeviceHeadersMiddleware(RequestDelegate next, ILogger<DeviceHeadersMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var deviceId = context.Request.Headers["X-Device-Id"].FirstOrDefault() ?? "unknown";
        var appVersion = context.Request.Headers["X-App-Version"].FirstOrDefault() ?? "unknown";
        var platform = context.Request.Headers["X-Platform"].FirstOrDefault() ?? "unknown";
        
        // Add to current activity for distributed tracing
        Activity.Current?.SetTag("device.id", deviceId);
        Activity.Current?.SetTag("app.version", appVersion);
        Activity.Current?.SetTag("device.platform", platform);
        
        // Add to logging scope
        using (_logger.BeginScope(new Dictionary<string, object>
        {
            ["DeviceId"] = deviceId,
            ["AppVersion"] = appVersion,
            ["Platform"] = platform,
            ["UserAgent"] = context.Request.Headers["User-Agent"].FirstOrDefault() ?? "unknown"
        }))
        {
            // Store in HttpContext for controllers to access
            context.Items["DeviceId"] = deviceId;
            context.Items["AppVersion"] = appVersion;
            context.Items["Platform"] = platform;
            
            await _next(context);
        }
    }
}
