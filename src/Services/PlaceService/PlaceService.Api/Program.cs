using MassTransit;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using PlaceService.Api.Application;
using PlaceService.Api.Infrastructure;
using Shared.Auth;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var mongoConnection = builder.Configuration["MongoDbSettings:ConnectionString"] ?? "mongodb://localhost:27017";
var mongoDatabase = builder.Configuration["MongoDbSettings:DatabaseName"] ?? "BlinkrPlaces";
builder.Services.AddSingleton<IMongoClient>(_ => new MongoClient(mongoConnection));
builder.Services.AddSingleton(sp => sp.GetRequiredService<IMongoClient>().GetDatabase(mongoDatabase));
builder.Services.AddScoped<IPlaceRepository, PlaceRepository>();
builder.Services.AddSingleton<ICurrentPlaceStateCalculator, CurrentPlaceStateCalculator>();
builder.Services.Configure<PlaceDiscoveryOptions>(builder.Configuration.GetSection("PlaceDiscovery"));
builder.Services.AddScoped<IPlaceDiscoveryService, PlaceDiscoveryService>();
builder.Services.AddHttpClient<IPlaceDiscoveryProvider, OverpassPlaceDiscoveryProvider>((sp, client) =>
{
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<PlaceDiscoveryOptions>>().Value;
    client.DefaultRequestHeaders.UserAgent.ParseAdd(options.UserAgent);
    client.Timeout = TimeSpan.FromSeconds(24);
});

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<PostCreatedPlaceSignalConsumer>();
    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMq:Host"] ?? "localhost", "/", h =>
        {
            h.Username(builder.Configuration["RabbitMq:User"] ?? "user");
            h.Password(builder.Configuration["RabbitMq:Pass"] ?? "password");
        });

        cfg.ReceiveEndpoint("place-service-post-created", e =>
        {
            e.ConfigureConsumer<PostCreatedPlaceSignalConsumer>(context);
        });
    });
});

var jwt = BlinkrJwtOptions.FromConfiguration(builder.Configuration, builder.Environment.EnvironmentName);
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = jwt.ClockSkew,
            NameClaimType = BlinkrJwtOptions.CanonicalUserIdClaim,
            RoleClaimType = BlinkrJwtOptions.RoleClaimType,
            AlgorithmValidator = (algorithm, _, _, _) =>
                algorithm == SecurityAlgorithms.HmacSha256 ||
                algorithm == SecurityAlgorithms.HmacSha256Signature
        };

        options.Events = new JwtBearerEvents
        {
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsync("{\"error\":\"Unauthorized\"}");
            }
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("api.write", policy => policy.RequireAuthenticatedUser());
});

builder.Services.AddHealthChecks()
    .AddMongoDb(_ => new MongoClient(mongoConnection), name: "places-mongodb", tags: new[] { "ready" });

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<IPlaceRepository>().EnsureIndexesAsync(CancellationToken.None);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();
app.MapHealthChecks("/health/ready").AllowAnonymous();
app.Run();
