using BlogService.Api;
using BlogService.Api.Extensions;
using BlogService.Api.Middlewares;
using BlogService.Api.RateLimiting;
using BlogService.Infrastructure.Data;
using HealthChecks.UI.Client;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.HttpOverrides;
using Serilog;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

const string corsPolicyName = "BlinkrCors";

builder.Host.UseSerilog((ctx, lc) =>
    lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

builder.Services
    .AddBlogCors(corsPolicyName)
    .AddBlogControllers()
    .AddBlogRateLimiting(builder.Configuration)
    .AddBlogApiVersioning()
    .AddBlogSwagger()
    .AddBlogDataStores(builder.Configuration)
    .AddBlogRepositoriesAndServices(builder.Configuration)
    .AddBlogMessaging(builder.Configuration)
    .AddBlogMediatR()
    .AddBlogAuthentication(builder.Configuration, builder.Environment.EnvironmentName)
    .AddBlogHealthChecks(builder.Configuration)
    .AddBlogResponseHandling()
    .AddBlogObservability();

// Forwarded Headers
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<BlogDbContext>();
    await db.Database.MigrateAsync();
}

// MongoDB index ensure
using (var scope = app.Services.CreateScope())
{
    var indexService = scope.ServiceProvider.GetRequiredService<BlogService.Infrastructure.Services.Indexes.MongoIndexService>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        await indexService.EnsureIndexesAsync();
        logger.LogInformation("🗺️ MongoDB indexes initialized successfully");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Failed to initialize MongoDB indexes");
        throw;
    }
}

// Pipeline
app.UseSerilogRequestLogging();
app.UseGlobalException();

// Request-Id middleware
app.Use(async (ctx, next) =>
{
    var rid = ctx.Request.Headers["X-Request-Id"].ToString();
    if (string.IsNullOrWhiteSpace(rid))
        rid = Activity.Current?.TraceId.ToString() ?? Guid.NewGuid().ToString("N");
    ctx.Response.Headers["Request-Id"] = rid;
    ctx.Items["RequestId"] = rid;
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(o =>
    {
        o.SwaggerEndpoint("/swagger/v1/swagger.json", "Blinkr API v1");
        // Sadece Bearer token kullanılacak, OAuth2 yok.
    });
}

app.UseForwardedHeaders();

if (app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

app.UseResponseCompression();
app.UseResponseCaching();

app.UseMiddleware<DeviceHeadersMiddleware>();

app.UseCors(corsPolicyName);

app.UseAuthentication();
// After authentication: the limits are per person (user + IP). Before, the user was never known here, so everyone
// behind the Gateway shared one IP bucket (S3, V2 closing).
app.UseMiddleware<RateLimitingMiddleware>();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();

// Health endpoints
app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = _ => true
}).AllowAnonymous();

app.MapHealthChecks("/health/liveness", new HealthCheckOptions
{
    Predicate = r => r.Name == "self"
}).AllowAnonymous();

app.MapHealthChecks("/health/readiness", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
}).AllowAnonymous();

// Prometheus metrics
app.MapPrometheusScrapingEndpoint("/metrics");

app.Run();
