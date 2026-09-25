using IdentityService.Api.Account;
using MassTransit;
using HealthChecks.UI.Client;
using IdentityService.Application.Interfaces;
using IdentityService.Infrastructure.Data;
using IdentityService.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Shared.Auth;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Swagger + JWT support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "IdentityService API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter 'Bearer' [space] and then your valid token.\nExample: \"Bearer eyJhbGciOi...\""
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

builder.Services.AddHttpClient();

// Follow events for notifications (sinyal-mvp-plan Faz 9). Publishing is best effort: see FollowsController.
builder.Services.AddMassTransit(bus =>
{
    bus.UsingRabbitMq((context, cfg) =>
    {
        var rabbit = builder.Configuration.GetSection("RabbitMq");
        cfg.Host(rabbit["Host"] ?? "localhost", "/", h =>
        {
            h.Username(rabbit["User"] ?? "user");
            h.Password(rabbit["Pass"] ?? "password");
        });
    });
});

// PostgreSQL DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// DI: Application <-> Infrastructure
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddAuthThrottle(builder.Configuration); // S3: sign-in / sign-up throttling
builder.Services.AddScoped<IdentityService.Api.Moderation.ModerationService>();
builder.Services.AddHostedService<IdentityService.Api.Account.AccountPurgeService>();

// Authentication & Authorization: IdentityService is the sole JWT authority for the MVP.
var jwtOptions = BlinkrJwtOptions.FromConfiguration(builder.Configuration, builder.Environment.EnvironmentName);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = jwtOptions.ClockSkew,
            NameClaimType = BlinkrJwtOptions.CanonicalUserIdClaim,
            RoleClaimType = BlinkrJwtOptions.RoleClaimType,
            AlgorithmValidator = (algorithm, _, _, _) =>
                algorithm == SecurityAlgorithms.HmacSha256 ||
                algorithm == SecurityAlgorithms.HmacSha256Signature
        };

        options.Events = new JwtBearerEvents
        {
            // A refresh token is not an access token (BLK-TOKENS-01).
            OnTokenValidated = ctx =>
            {
                if (!Shared.Auth.BlinkrJwtOptions.IsAccessToken(ctx.Principal)) ctx.Fail("Refresh tokens cannot be used as access tokens.");
                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsync("{\"error\":\"Unauthorized\"}");
            }
        };
    });

// Moderation endpoints (Faz 10 P10.4). JwtBearer maps the "role" claim to ClaimTypes.Role on the way in, so the
// policy accepts either type instead of relying on [Authorize(Roles)] with RoleClaimType = "role".
builder.Services.AddAuthorization(options =>
    options.AddPolicy(IdentityService.Api.Moderation.AdminModerationController.AdminPolicy, policy => policy
        .RequireAuthenticatedUser()
        .RequireAssertion(ctx => ctx.User.Claims.Any(c =>
            (c.Type == BlinkrJwtOptions.RoleClaimType || c.Type == System.Security.Claims.ClaimTypes.Role) && c.Value == "Admin"))));

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>(
        "IdentityService-Postgres",
        failureStatus: HealthStatus.Unhealthy,
        tags: new[] { "db", "postgres", "ready" });
// (No Redis check: Identity does not use Redis; a Redis outage must not mark sign-in unhealthy.)

// ---------- Logging ----------
builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.Seq("http://localhost:5341"));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.UseHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});
// CLAUDE.md §21 P1: live = the process answers (no dependencies); ready = the dependencies it really uses.
app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = r => r.Tags.Contains("ready"), ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse }).AllowAnonymous();

app.Run();
