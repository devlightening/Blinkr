using System.Security.Claims;
using NotificationsService.Api.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddNotificationsControllers()
    .AddNotificationsMediatR()
    .AddNotificationsRepositories()
    .AddNotificationsMessaging(builder.Configuration)
    .AddNotificationsAuthentication(builder.Configuration)
    .AddNotificationsSwagger()
    .AddNotificationsMongoDB(builder.Configuration)
    .AddNotificationsHealthChecks();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(o =>
    {
        o.SwaggerEndpoint("/swagger/v1/swagger.json", "Notifications API v1");
    });
}

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready")
}).AllowAnonymous();

app.Run();

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal user)
    {
        var userIdClaim = user.FindFirst("sub") ?? user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        if (userIdClaim?.Value != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }
        throw new InvalidOperationException("User ID not found in claims");
    }
}
