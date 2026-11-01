namespace NotificationsService.Application.Snaps;

/// <summary>Limits and lifetimes of snaps. Bound from the "Snaps" configuration section.</summary>
public class SnapSettings
{
    public string StorageRoot { get; set; } = "App_Data/snaps";
    public int MaxImageBytes { get; set; } = 10 * 1024 * 1024;
    public int MaxVideoBytes { get; set; } = 40 * 1024 * 1024;

    /// <summary>An unopened snap disappears after this long: information about a place goes stale, so nothing is kept for weeks.</summary>
    public int ExpiresAfterHours { get; set; } = 24;

    /// <summary>Extra seconds after the timer so a slow phone can still finish loading what it was allowed to open.</summary>
    public int ViewGraceSeconds { get; set; } = 30;

    /// <summary>How long the media stays readable after opening when there is no timer (video, or "until closed").</summary>
    public int UntimedViewSeconds { get; set; } = 180;

    public int CleanupIntervalSeconds { get; set; } = 300;
    public int MaxCaptionLength { get; set; } = 80;

    public TimeSpan ViewWindow(int durationSeconds) =>
        TimeSpan.FromSeconds(durationSeconds > 0 ? durationSeconds + ViewGraceSeconds : UntimedViewSeconds);
}
