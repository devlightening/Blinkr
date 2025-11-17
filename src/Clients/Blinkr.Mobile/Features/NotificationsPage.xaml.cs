using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features;

public partial class NotificationsPage : ContentPage
{
    private readonly NotificationsViewModel _viewModel;

    public NotificationsPage(INotificationsApiClient notificationsApi)
    {
        InitializeComponent();
        _viewModel = new NotificationsViewModel(notificationsApi);
        BindingContext = _viewModel;
    }
    
    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _viewModel.LoadNotificationsCommand.ExecuteAsync(null);
    }

}

/// <summary>
/// ViewModel for notifications page with real API integration
/// </summary>
public partial class NotificationsViewModel : ObservableObject
{
    private readonly INotificationsApiClient _notificationsApi;

    [ObservableProperty] private bool isBusy;
    [ObservableProperty] private bool isRefreshing;
    [ObservableProperty] private string statusMessage = "Bildirimler yükleniyor...";
    
    public ObservableCollection<NotificationItemViewModel> Notifications { get; } = new();

    public NotificationsViewModel(INotificationsApiClient notificationsApi)
    {
        _notificationsApi = notificationsApi;
    }

    [RelayCommand]
    public async Task LoadNotificationsAsync()
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            StatusMessage = "Bildirimler yükleniyor...";

            var result = await _notificationsApi.GetNotificationsAsync(page: 1, pageSize: 50);
            
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                Notifications.Clear();
                foreach (var notification in result.Items)
                {
                    Notifications.Add(new NotificationItemViewModel(notification, this));
                }
                
                StatusMessage = Notifications.Count == 0 
                    ? "Henüz bildirim yok" 
                    : $"{Notifications.Count} bildirim";
            });
        }
        catch (Exception ex)
        {
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                StatusMessage = $"Hata: {ex.Message}";
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    public async Task RefreshAsync()
    {
        if (IsRefreshing) return;
        
        try
        {
            IsRefreshing = true;
            await LoadNotificationsAsync();
        }
        finally
        {
            IsRefreshing = false;
        }
    }

    /// <summary>
    /// Mark notification as read and update UI
    /// </summary>
    public async Task MarkAsReadAsync(NotificationItemViewModel notification)
    {
        if (notification.IsRead) return;

        try
        {
            await _notificationsApi.MarkReadAsync(new MarkReadRequest(new[] { notification.Id }));
            
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                notification.IsRead = true;
            });
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NotificationsViewModel] Mark as read failed: {ex.Message}");
        }
    }
}

/// <summary>
/// ViewModel wrapper for notification items with UI-specific properties
/// </summary>
public partial class NotificationItemViewModel : ObservableObject
{
    private readonly NotificationsViewModel _parent;
    
    [ObservableProperty] private bool isRead;
    
    public string Id { get; }
    public string Type { get; }
    public string Title { get; }
    public string Body { get; }
    public string? DeepLink { get; }
    public DateTime CreatedAtUtc { get; }
    
    /// <summary>
    /// Human-readable relative time ("5 dk önce", "2 sa önce")
    /// </summary>
    public string RelativeTime => GetRelativeTime(CreatedAtUtc);
    
    /// <summary>
    /// Display title with unread indicator
    /// </summary>
    public string DisplayTitle => IsRead ? Title : $"● {Title}";

    public NotificationItemViewModel(NotificationDto notification, NotificationsViewModel parent)
    {
        _parent = parent;
        Id = notification.Id;
        Type = notification.Type;
        Title = notification.Title;
        Body = notification.Body;
        DeepLink = notification.DeepLink;
        CreatedAtUtc = notification.CreatedAtUtc;
        IsRead = notification.IsRead;
    }

    [RelayCommand]
    public async Task TapAsync()
    {
        // Mark as read when tapped
        await _parent.MarkAsReadAsync(this);
        
        // TODO: Handle deep link navigation
        if (!string.IsNullOrEmpty(DeepLink))
        {
            System.Diagnostics.Debug.WriteLine($"[NotificationItem] Deep link: {DeepLink}");
            // Navigate to specific post/content
        }
    }
    
    private static string GetRelativeTime(DateTime createdAtUtc)
    {
        var elapsed = DateTime.UtcNow - createdAtUtc;
        
        if (elapsed.TotalMinutes < 1)
            return "Az önce";
        else if (elapsed.TotalMinutes < 60)
            return $"{(int)elapsed.TotalMinutes} dk önce";
        else if (elapsed.TotalHours < 24)
            return $"{(int)elapsed.TotalHours} sa önce";
        else if (elapsed.TotalDays < 7)
            return $"{(int)elapsed.TotalDays} gün önce";
        else
            return createdAtUtc.ToLocalTime().ToString("dd.MM.yyyy");
    }
    
    partial void OnIsReadChanged(bool value)
    {
        OnPropertyChanged(nameof(DisplayTitle));
    }
}
