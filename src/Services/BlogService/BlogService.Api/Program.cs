using BlogService.Api.Auth;
using BlogService.Application.Common.Behaviors;
using BlogService.Application.Mappings;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Extensions;
using FluentValidation;
using FluentValidation.AspNetCore;
using HealthChecks.UI.Client;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.IdentityModel.Tokens.Jwt;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// ---- Serilog
builder.Host.UseSerilog((ctx, lc) =>
    lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

// ---- Controllers + JSON
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        o.JsonSerializerOptions.PropertyNamingPolicy = null;
    });

// ---- FluentValidation
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<BlogService.Application.Validators.Post.CreatePostDtoValidator>();

builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = ctx =>
    {
        var errors = ctx.ModelState
            .Where(x => x.Value?.Errors.Count > 0)
            .ToDictionary(k => k.Key, v => v.Value!.Errors.Select(e => e.ErrorMessage).ToArray());

        return new BadRequestObjectResult(new { message = "Validation failed", errors });
    };
});

// ---- Swagger + Bearer
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "BlogService.Api", Version = "v1" });
    c.SwaggerDoc("v2", new() { Title = "BlogService.Api", Version = "v2" });


    c.AddSecurityDefinition("oauth2", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.OAuth2,
        Flows = new OpenApiOAuthFlows
        {
            Password = new OpenApiOAuthFlow
            {
                TokenUrl = new Uri("https://localhost:7122/connect/token"),
                Scopes = new Dictionary<string, string>{
                {"blinkr.api.read","Read"},
                {"blinkr.api.write","Write"},
                {"openid","OpenID"},
                {"profile","Profile"},
                {"roles","Roles"}
            }
            }
        }
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement{
    { new OpenApiSecurityScheme{ Reference = new OpenApiReference{
        Type = ReferenceType.SecurityScheme, Id = "oauth2"}}, new []{"blinkr.api.read","blinkr.api.write"}}
        });


    c.AddSecurityDefinition("Bearer", new()
    {
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Enter: Bearer {token}"
    });

    c.AddSecurityRequirement(new()
    {
        {
            new()
            {
                Reference = new()
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});



builder.Services.AddSingleton<IAuthorizationHandler, OwnerOrAdminHandler>();
// ---- Infrastructure (DbContext + Repos)
builder.Services.AddInfrastructure(builder.Configuration);

// ---- AutoMapper
builder.Services.AddAutoMapper(cfg =>
{
    cfg.AddProfile<PostMappingProfile>();
});

// ---- MediatR + Validation pipeline
builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(Assembly.Load("BlogService.Application")));
builder.Services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var issuer = "https://localhost:7122";
var audience = "blinkr.api";

var publicPemPath = Path.Combine(
    builder.Environment.ContentRootPath,
    "..", "..",                      
    "IdentityServerService",         
    "IdentityServerService",
    "keys",
    "rsa-public.pem");

var publicPemFullPath = Path.GetFullPath(publicPemPath);
if (!File.Exists(publicPemFullPath))
{
    throw new FileNotFoundException($"Public key not found: {publicPemFullPath}");
}

var publicPem = File.ReadAllText(publicPemFullPath);
var rsa = RSA.Create();
rsa.ImportFromPem(publicPem);

var rsaKey = new RsaSecurityKey(rsa) { KeyId = "blinkr-dev-key" };

JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap.Clear();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, o =>
    {
        // Discovery/JWKS KULLANMIYORUZ -> Authority/MetadataAddress vermiyoruz.
        o.RequireHttpsMetadata = false; // dev kolaylığı

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

        // KRİTİK EKLEMELER: Claim dönüşümünü tamamen kapat.
        // Bu, SUB ve ROLE gibi claim'lerin, .NET'in System.Security.Claims.ClaimTypes.NameIdentifier
        // gibi varsayılan tiplere dönüşmeden, token'daki orijinal isimleriyle kalmasını sağlar.
        o.MapInboundClaims = false; // EKLE

        // Hata ayıklama için (isteğe bağlı)
        o.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                // Kontrol için konsola sub claim'ini yazdırın
                var sub = context.Principal.FindFirst("sub")?.Value;
                Console.WriteLine($"[AUTHZ DEBUG] Token Validated. SUB Claim: {sub}");
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("api.read", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim(c =>
                c.Type == "scope" &&
                c.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                       .Contains("blinkr.api.read"))));

    options.AddPolicy("api.write", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim(c =>
                c.Type == "scope" &&
                c.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                       .Contains("blinkr.api.write"))));

    options.AddPolicy("AdminOnly", p => p.RequireRole("Admin"));
});



builder.Services.AddHealthChecks()
    .AddDbContextCheck<BlogDbContext>(
        name: "BlogService-Postgres",
        failureStatus: HealthStatus.Unhealthy,
        tags: new[] { "db", "postgres" })
    .AddRedis("localhost:6379", name: "Redis", tags: new[] { "cache" });

var app = builder.Build();

// ---- Pipeline
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseGlobalException();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.UseHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.Run();
