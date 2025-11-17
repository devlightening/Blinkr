namespace NotificationsService.Domain.ValueObjects;

public class NotificationContent
{
    public string Title { get; set; } = default!;
    public string Body  { get; set; } = default!;
    public string? DeepLink { get; set; }
    public string? ImageUrl { get; set; }
}