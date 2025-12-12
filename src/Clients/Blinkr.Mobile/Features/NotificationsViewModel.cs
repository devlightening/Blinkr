using System.Collections.ObjectModel;
using System.Linq;
using Blinkr.Mobile.Core.Api;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Blinkr.Mobile.Features;

public class NotificationsViewModel : ObservableObject
{
    private readonly INotificationsApiClient _notifications;

    private ObservableCollection<NotificationItem> _notificationsCollection = new();
    public ObservableCollection<NotificationItem> Notifications
    {
        get => _notificationsCollection;
        private set => SetProperty(ref _notificationsCollection, value);
    }

    public IAsyncRelayCommand LoadCommand { get; }
    public IAsyncRelayCommand MarkAllAsReadCommand { get; }

    public NotificationsViewModel(INotificationsApiClient notifications)
    {
        _notifications = notifications;
        LoadCommand = new AsyncRelayCommand(LoadAsync);
        MarkAllAsReadCommand = new AsyncRelayCommand(MarkAllAsReadAsync);
    }

    private async Task LoadAsync()
    {
        try
        {
            var result = await _notifications.GetNotificationsAsync();
            if (result?.Items == null) return;

            var items = result.Items.Select(MapDto).ToList();
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                Notifications = new ObservableCollection<NotificationItem>(items);
                OnPropertyChanged(nameof(Notifications));
            });
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Notifications] load error: {ex.Message}");
        }
    }

    private async Task MarkAllAsReadAsync()
    {
        try
        {
            await _notifications.MarkReadAsync(null);
            foreach (var n in Notifications)
            {
                n.IsRead = true;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Notifications] mark all read error: {ex.Message}");
        }
    }

    private static NotificationItem MapDto(NotificationDto dto)
    {
        return new NotificationItem
        {
            Id = dto.Id,
            Type = dto.Type,
            Title = dto.Title,
            Message = dto.Body,
            TimeAgo = ToTimeAgo(dto.CreatedAtUtc),
            IsRead = dto.IsRead
        };
    }

    private static string ToTimeAgo(DateTime createdAtUtc)
    {
        var elapsed = DateTime.UtcNow - createdAtUtc;

        if (elapsed.TotalMinutes < 1)
            return "Az önce";
        if (elapsed.TotalMinutes < 60)
            return $"{(int)elapsed.TotalMinutes} dk önce";
        if (elapsed.TotalHours < 24)
            return $"{(int)elapsed.TotalHours} sa önce";
        if (elapsed.TotalDays < 7)
            return $"{(int)elapsed.TotalDays} gün önce";
        return createdAtUtc.ToLocalTime().ToString("dd.MM.yyyy");
    }
}

