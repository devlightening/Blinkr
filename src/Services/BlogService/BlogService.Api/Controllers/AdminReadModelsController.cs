using BlogService.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogService.Api.Controllers;

/// <summary>
/// Admin endpoints for read model maintenance and synchronization
/// Only available in development environment
/// </summary>
[ApiController]
[Route("api/admin/[controller]")]
[Authorize(Policy = "api.admin")]
public class ReadModelsController : ControllerBase
{
    private readonly IPostMaintenanceService _postMaintenanceService;
    private readonly IPostReadModelSyncService _postReadModelSyncService;
    private readonly ILogger<ReadModelsController> _logger;
    private readonly IWebHostEnvironment _environment;

    public ReadModelsController(
        IPostMaintenanceService postMaintenanceService,
        IPostReadModelSyncService postReadModelSyncService,
        ILogger<ReadModelsController> logger,
        IWebHostEnvironment environment)
    {
        _postMaintenanceService = postMaintenanceService;
        _postReadModelSyncService = postReadModelSyncService;
        _logger = logger;
        _environment = environment;
    }

    /// <summary>
    /// WS-10B: Sync AuthorName in MongoDB posts from Identity Users table
    /// This endpoint backfills existing MongoDB documents with correct author names
    /// Only available in development environment
    /// </summary>
    [HttpPost("sync-author-names")]
    public async Task<IActionResult> SyncAuthorNames(CancellationToken cancellationToken)
    {
        // Only allow in development
        if (!_environment.IsDevelopment())
        {
            _logger.LogWarning("WS-10B: Attempt to sync author names in non-development environment");
            return Forbid("This operation is only available in development environment");
        }

        _logger.LogInformation("WS-10B: Admin initiated AuthorName sync");

        try
        {
            var updatedCount = await _postMaintenanceService.SyncAuthorNamesAsync(cancellationToken);
            return Ok(new 
            { 
                success = true,
                message = $"AuthorName sync completed",
                updatedCount = updatedCount
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WS-10B: Error during AuthorName sync");
            return StatusCode(500, new 
            { 
                success = false,
                message = "Error during sync operation",
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// WS-11A: Sync posts from Postgres to MongoDB read model
    /// This endpoint backfills missing posts from Postgres write model to MongoDB read model
    /// Only available in development environment
    /// </summary>
    [HttpPost("sync-posts-from-postgres")]
    public async Task<IActionResult> SyncPostsFromPostgres(CancellationToken cancellationToken)
    {
        // Only allow in development
        if (!_environment.IsDevelopment())
        {
            _logger.LogWarning("WS-11A: Attempt to sync posts in non-development environment");
            return Forbid("This operation is only available in development environment");
        }

        _logger.LogInformation("WS-11A: Admin initiated Postgres to MongoDB sync");

        try
        {
            var syncedCount = await _postReadModelSyncService.SyncMissingPostsToMongoAsync(cancellationToken);
            return Ok(new 
            { 
                success = true,
                message = "Postgres to MongoDB sync completed",
                syncedCount = syncedCount
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WS-11A: Error during Postgres to MongoDB sync");
            return StatusCode(500, new 
            { 
                success = false,
                message = "Error during sync operation",
                error = ex.Message
            });
        }
    }
}
