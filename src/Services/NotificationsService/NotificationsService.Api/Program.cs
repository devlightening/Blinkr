using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MassTransit;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using NotificationsService.Application.Queries;
using NotificationsService.Domain.Interfaces;
using NotificationsService.Infrastructure.Repositories;
using NotificationsService.Infrastructure.Config;
using NotificationsService.Infrastructure.Messaging;
using NotificationsService.Infrastructure.Push;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddEndpointsApiExplorer();

// MediatR for Application layer handlers
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(GetUnreadCountQuery).Assembly);
});

// Repositories used by handlers
builder.Services.AddScoped<INotificationRepository, MongoNotificationRepository>();
builder.Services.AddScoped<IDeviceTokenRepository, MongoNotificationRepository>();

// RabbitMQ options for EventConsumer
builder.Services.Configure<RabbitOptions>(builder.Configuration.GetSection("RabbitMQ"));

// MassTransit consumers for integration events
builder.Services.AddMassTransit(busCfg =>
{
    busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.EventConsumer.PostLikedNotificationConsumer>();
    busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.EventConsumer.PostCommentAddedNotificationConsumer>();

    busCfg.UsingRabbitMq((ctx, cfg) =>
    {
        var rabbit = builder.Configuration.GetSection("RabbitMQ");

        var host = rabbit["HostName"] ?? "localhost";
        var user = rabbit["UserName"] ?? "guest";
        var pass = rabbit["Password"] ?? "guest";
        var portStr = rabbit["Port"];
        ushort port = 0;
        ushort.TryParse(portStr, out port);

        var logger = ctx.GetRequiredService<ILogger<Program>>();
        logger.LogInformation("WS-07A-RMQ-URI-FIX: Configuring RabbitMQ host={Host} port={Port} user={User}", host, port, user);

        if (port > 0)
        {
            cfg.Host(host, port, "/", h =>
            {
                h.Username(user);
                h.Password(pass);
            });
        }
        else
        {
            cfg.Host(host, "/", h =>
            {
                h.Username(user);
                h.Password(pass);
            });
        }

        cfg.ConfigureEndpoints(ctx);
    });
});

// Push sender (Noop in dev unless configured otherwise)
builder.Services.AddScoped<IPushSender>(sp =>
{
    var logger = sp.GetRequiredService<ILogger<NoopSender>>();
    return new NoopSender(logger);
});

// Hosted consumer that listens to RabbitMQ events (raw RabbitMQ for other topics)
builder.Services.AddHostedService<EventConsumer>();

// JWT Authentication
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtIssuer = jwtSection["Issuer"];
var jwtAudience = jwtSection["Audience"]; 
var jwtKey = jwtSection["Key"];

if (string.IsNullOrWhiteSpace(jwtKey))
{
    throw new InvalidOperationException("Jwt:Key is not configured. Check appsettings.Development.json.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false; // dev
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = "sub",
            RoleClaimType = "role"
        };

        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = ctx =>
            {
                Console.WriteLine($"[JWT FAILED] {ctx.Exception.Message}");
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

builder.Services.AddAuthorization();

// Swagger Bearer JWT
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Notifications API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "JWT: Bearer {token}",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// MongoDB with proper Guid configuration
// GuidRepresentationMode not available in this driver version; relying on per-field attributes and serializer registration
BsonSerializer.RegisterSerializer(new MongoDB.Bson.Serialization.Serializers.GuidSerializer(GuidRepresentation.Standard));

builder.Services.AddSingleton<IMongoClient>(sp =>
{
    var connectionString = builder.Configuration.GetSection("Mongo")["ConnectionString"];
    return new MongoClient(connectionString);
});

builder.Services.AddSingleton<IMongoDatabase>(sp =>
{
    var client = sp.GetRequiredService<IMongoClient>();
    var databaseName = builder.Configuration.GetSection("Mongo")["Database"];
    return client.GetDatabase(databaseName);
});

// Health Checks
builder.Services.AddHealthChecks()
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy())
    .AddMongoDb(sp => sp.GetRequiredService<IMongoClient>(), name: "mongodb", tags: new[] { "ready" });

var app = builder.Build();

// Configure the HTTP request pipeline
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

// Health endpoints
app.MapHealthChecks("/health").AllowAnonymous();
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready")
}).AllowAnonymous();

app.Run();

// Extension Methods
public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal user)
    {
        var userIdClaim = user.FindFirst("sub") ?? user.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim?.Value != null && Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return userId;
        }
        throw new InvalidOperationException("User ID not found in claims");
    }
}