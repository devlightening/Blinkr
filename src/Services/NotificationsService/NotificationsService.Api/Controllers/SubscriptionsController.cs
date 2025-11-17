using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotificationsService.Application.Commands;
using NotificationsService.Domain.Entities;
using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;

namespace NotificationsService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SubscriptionsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IMongoDatabase _db;
    private readonly ILogger<SubscriptionsController> _logger;
    
    public SubscriptionsController(
        IMediator mediator, 
        IMongoDatabase db,
        ILogger<SubscriptionsController> logger)
    {
        _mediator = mediator;
        _db = db;
        _logger = logger;
    }

    public record RegisterReq(string DeviceToken, string? Platform);

    [HttpPost]
    public async Task<IActionResult> Register([FromBody] RegisterReq req)
    {
        var userId = User.GetUserId();
        await _mediator.Send(new RegisterDeviceTokenCommand(
            userId, req.DeviceToken, req.Platform ?? "android"));
        return NoContent();
    }
    
    public record UpdateLocationReq(double Latitude, double Longitude);
    
    /// <summary>
    /// Update user location for proximity notifications
    /// </summary>
    [HttpPost("location")]
    public async Task<IActionResult> UpdateLocation([FromBody] UpdateLocationReq req)
    {
        try
        {
            var userId = User.GetUserId();
            
            _logger.LogInformation("📍 Updating location for user {UserId}: ({Lat}, {Lon})", 
                userId, req.Latitude, req.Longitude);
            
            var collection = _db.GetCollection<UserLocation>("user_locations");
            
            var location = new GeoJsonPoint<GeoJson2DGeographicCoordinates>(
                new GeoJson2DGeographicCoordinates(req.Longitude, req.Latitude));
            
            var filter = Builders<UserLocation>.Filter.Eq(x => x.UserId, userId);
            var update = Builders<UserLocation>.Update
                .Set(x => x.Location, location)
                .Set(x => x.UpdatedAtUtc, DateTime.UtcNow)
                .SetOnInsert(x => x.UserId, userId);
            
            await collection.UpdateOneAsync(
                filter, 
                update, 
                new UpdateOptions { IsUpsert = true });
            
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update user location");
            return StatusCode(500, new { error = "Failed to update location" });
        }
    }
}
