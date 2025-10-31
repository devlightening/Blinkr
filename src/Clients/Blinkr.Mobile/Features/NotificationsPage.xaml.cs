using System.Collections.ObjectModel;
using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features;

public partial class NotificationsPage : ContentPage
{
    private readonly IApiClient? _apiClient;
    public ObservableCollection<NotificationItem> Notifications { get; set; } = new();

    public NotificationsPage(IApiClient? apiClient = null)
    {
        InitializeComponent();
        _apiClient = apiClient;
        LoadSampleData();
        BindingContext = this;
    }

    private void LoadSampleData()
    {
        Notifications = new ObservableCollection<NotificationItem>
        {
            new NotificationItem
            {
                Avatar = "👤",
                AvatarColor = Color.FromArgb("#8B5CF6"),
                Title = "Kullanıcı Adı",
                Message = "gönderini beğendi.",
                ActionIcon = "❤️",
                ActionColor = Color.FromArgb("#EF4444"),
                TimeAgo = "2s"
            },
            new NotificationItem
            {
                Avatar = "👤",
                AvatarColor = Color.FromArgb("#10B981"),
                Title = "Başka Biri",
                Message = "gönderini beğendi.",
                ActionIcon = "❤️",
                ActionColor = Color.FromArgb("#EF4444"),
                TimeAgo = "2s"
            },
            new NotificationItem
            {
                Avatar = "👤",
                AvatarColor = Color.FromArgb("#F59E0B"),
                Title = "Başka Biri",
                Message = "yeni bir yorum yaptı: \"Harika ufk yer!\"",
                ActionIcon = "💬",
                ActionColor = Color.FromArgb("#6B7280"),
                TimeAgo = "5dk"
            },
            new NotificationItem
            {
                Avatar = "📍",
                AvatarColor = Color.FromArgb("#8B5CF6"),
                Title = "Yakınınızda - Yeni Bir",
                Message = "Mekan kuruldu!",
                ActionIcon = "📍",
                ActionColor = Color.FromArgb("#8B5CF6"),
                TimeAgo = "5dk"
            },
            new NotificationItem
            {
                Avatar = "📍",
                AvatarColor = Color.FromArgb("#10B981"),
                Title = "Yandısatın iş Başçib athler",
                Message = "Kanika ufk yer!",
                ActionIcon = "💬",
                ActionColor = Color.FromArgb("#6B7280"),
                TimeAgo = "5dk"
            },
            new NotificationItem
            {
                Avatar = "📍",
                AvatarColor = Color.FromArgb("#F59E0B"),
                Title = "Yakınınızda Yeni Bir Mekan",
                Message = "Keşipded",
                ActionIcon = "💬",
                ActionColor = Color.FromArgb("#6B7280"),
                TimeAgo = "1s"
            }
        };
    }
}

public class NotificationItem
{
    public string Avatar { get; set; } = string.Empty;
    public Color AvatarColor { get; set; } = Colors.Gray;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string ActionIcon { get; set; } = string.Empty;
    public Color ActionColor { get; set; } = Colors.Gray;
    public string TimeAgo { get; set; } = string.Empty;
}
