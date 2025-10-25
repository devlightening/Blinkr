namespace BlogService.Application.Features.Mediatr.Comamnds.PostLocationCommands;

/// <summary>
/// Location precision mode for privacy control
/// </summary>
public enum LocationPrecision
{
    /// <summary>
    /// Exact coordinates (default)
    /// </summary>
    Precise = 0,
    
    /// <summary>
    /// Approximate coordinates (~1.2km grid) for privacy
    /// </summary>
    Approximate = 1
}
