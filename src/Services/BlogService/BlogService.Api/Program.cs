using BlogService.Application.Interfaces;
using BlogService.Infrastructure.Extensions;
using BlogService.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Infrastructure (DbContext, Repositories)
builder.Services.AddInfrastructure(builder.Configuration);

// DI: Application <-> Infrastructure
builder.Services.AddScoped<IPostService, PostService>();

// Authentication (JWT)
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.Authority = "https://localhost:7122"; // IdentityServer URL
        options.RequireHttpsMetadata = true;
        options.Audience = "blinkr.api"; // token aud
    });

builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
