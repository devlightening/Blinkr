using CommunityToolkit.Mvvm.ComponentModel;

namespace Blinkr.Mobile.Features;

public partial class NotificationItem : ObservableObject
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = ""; // "like", "comment", "system"
    public string Icon => Type switch
    {
        "like" => "👍",
        "comment" => "💬",
        _ => "🔔"
    };
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string TimeAgo { get; set; } = "";

    private bool _isRead;
    public bool IsRead
    {
        get => _isRead;
        set => SetProperty(ref _isRead, value);
    }
}

