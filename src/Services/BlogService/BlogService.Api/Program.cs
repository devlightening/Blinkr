using BlogService.Api;
using BlogService.Api.Auth;
using BlogService.Application.Common.Behaviors;
using BlogService.Application.Common.Interfaces;
using BlogService.Application.Mappings;
using BlogService.Application.Validators.PostValidators;
using BlogService.Infrastructure;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Repositories;
using BlogService.Infrastructure.Services;
using EventStore.Client;
using FluentValidation;
using FluentValidation.AspNetCore;
using HealthChecks.UI.Client;
using MassTransit;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MongoDB.Driver;
using Serilog;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

const string corsPolicyName = "BlinkrCors";
builder.Services.AddCors(o =>
{
    o.AddPolicy(corsPolicyName, p =>
    {
        p.WithOrigins("https://localhost:7259", "https://localhost:5173").AllowAnyHeader().AllowAnyMethod();
    });
});
builder.Host.UseSerilog((ctx, lc) => lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());
builder.Services.AddHttpContextAccessor();
builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<CreatePostDtoValidator>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "BlogService.Api", Version = "v1" });
    c.AddSecurityDefinition("oauth2", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.OAuth2,
        Flows = new OpenApiOAuthFlows
        {
            Password = new OpenApiOAuthFlow
            {
                TokenUrl = new Uri("https://localhost:7122/connect/token"),
                Scopes = new Dictionary<string, string> {
                    {"blinkr.api.read","Read"}, {"blinkr.api.write","Write"},
                    {"openid","OpenID"}, {"profile","Profile"}, {"roles","Roles"},
                    {"offline_access","Refresh token"}
                }
            }
        }
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement{
        { new OpenApiSecurityScheme{
            Reference = new OpenApiReference{ Type = ReferenceType.SecurityScheme, Id = "oauth2"} },
            new []{ "blinkr.api.read","blinkr.api.write" } }
    });
});

// --- SERVİS KAYITLARI (TAM VE DÜZELTİLMİŞ) ---

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// PostgreSQL DbContext (Sadece eski Read Model ve gerekirse diğer tablolar için)
builder.Services.AddDbContext<BlogDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("BlogDb")));

// EventStoreDB İstemcisi
builder.Services.AddSingleton<EventStoreClient>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("EventStore");
    if (string.IsNullOrEmpty(connectionString)) throw new InvalidOperationException("EventStore connection string not configured.");
    var settings = EventStoreClientSettings.Create(connectionString);
    return new EventStoreClient(settings);
});

// MongoDB İstemcisi (Read Handler'lar için)
builder.Services.AddSingleton<IMongoClient>(sp =>
    new MongoClient(builder.Configuration.GetConnectionString("MongoDb")));
builder.Services.AddSingleton<IMongoDatabase>(sp =>
{
    var client = sp.GetRequiredService<IMongoClient>();
    var dbName = builder.Configuration["MongoDbSettings:DatabaseName"];
    if (string.IsNullOrEmpty(dbName)) throw new InvalidOperationException("MongoDB DatabaseName is not configured.");
    return client.GetDatabase(dbName);
});

builder.Services.AddSingleton<ICheckpointStore, MongoCheckpointStore>();


// Repository Kayıtları
builder.Services.AddScoped<EventStoreDbRepository>(); // Inner repository
builder.Services.AddScoped<IEventStoreRepository>(sp =>
{
    var inner = sp.GetRequiredService<EventStoreDbRepository>();
    var bus = sp.GetRequiredService<IBus>();
    var logger = sp.GetRequiredService<ILogger<EventStorePublishingDecorator>>();
    return new EventStorePublishingDecorator(inner, bus, logger);
});
builder.Services.AddScoped<IPostReadRepository, PostReadRepository>();

// Query Service (MongoDB Read Model) with Redis caching
builder.Services.AddScoped<BlogService.Api.Services.PostQueryService>(); // Inner service
builder.Services.AddScoped<BlogService.Api.Services.IPostQueryService>(sp =>
{
    var inner = sp.GetRequiredService<BlogService.Api.Services.PostQueryService>();
    var cache = sp.GetRequiredService<IDistributedCache>();
    var logger = sp.GetRequiredService<ILogger<BlogService.Api.Services.CachedPostQueryService>>();
    return new BlogService.Api.Services.CachedPostQueryService(inner, cache, logger);
});

// EventStoreDB'yi dinleyecek olan arka plan servisi.
// DISABLED: Hot loop issue - using direct publish from domain events instead
// builder.Services.AddHostedService<EventStoreToRabbitMqPublisher>();

// MassTransit (Sadece Yayıncı olarak ayarlandı)
builder.Services.AddMassTransit(busConfig =>
{
    busConfig.UsingRabbitMq((context, cfg) =>
    {
        var rabbitMqConfig = builder.Configuration.GetSection("RabbitMq");
        cfg.Host(rabbitMqConfig["Host"], "/", h => {
            h.Username("user");
            h.Password("password");
        });
    });
});

// Diğer Servisler
builder.Services.AddSingleton<IAuthorizationHandler, OwnerOrAdminHandler>();
builder.Services.AddAutoMapper(cfg => cfg.AddProfile<PostMappingProfile>());
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.Load("BlogService.Application")));
builder.Services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

var issuer = "https://localhost:7122";
var audience = "blinkr.api";
var publicPemPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "IdentityServerService", "IdentityServerService", "keys", "rsa-public.pem"));
if (!File.Exists(publicPemPath)) throw new FileNotFoundException($"Public key not found: {publicPemPath}");
var publicPem = File.ReadAllText(publicPemPath);
var rsa = RSA.Create();
rsa.ImportFromPem(publicPem);
var rsaKey = new RsaSecurityKey(rsa) { KeyId = "blinkr-dev-key" };
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = issuer,
        ValidateAudience = true,
        ValidAudiences = new[] { audience, $"{issuer}/resources" },
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = rsaKey,
        NameClaimType = "sub",
        RoleClaimType = "role"
    };
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("api.read", policy => policy.RequireClaim("scope", "blinkr.api.read"));
    options.AddPolicy("api.write", policy => policy.RequireClaim("scope", "blinkr.api.write"));
    options.AddPolicy("AdminOnly", p => p.RequireRole("Admin"));
});
builder.Services.AddHealthChecks();

var app = builder.Build();

// ---- Pipeline ----
app.UseSerilogRequestLogging();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseHttpsRedirection();
app.UseCors(corsPolicyName);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health", new HealthCheckOptions { ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse });

app.Run();

