using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Core.Services;

public class EnvironmentService
{
    private readonly EnvironmentConfig _config;

    public EnvironmentService()
    {
        _config = LoadEnvironmentConfig();
    }

    public EnvironmentConfig Current => _config;

    private static EnvironmentConfig LoadEnvironmentConfig()
    {
        try
        {
            var environmentName = GetEnvironmentName();
            var json = LoadEnvironmentJson();
            var environments = JsonSerializer.Deserialize<Dictionary<string, EnvironmentConfig>>(json);
            
            if (environments?.TryGetValue(environmentName, out var config) == true)
            {
                return config;
            }

            // Fallback to Development
            return environments?["Development"] ?? new EnvironmentConfig
            {
                ApiBaseUrl = "http://10.0.2.2:5215",
                IdentityBaseUrl = "http://10.0.2.2:7122",
                EnableLogging = true,
                CacheTimeout = 300,
                RequestTimeout = 30,
                RetryCount = 3
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to load environment config: {ex.Message}");
            
            // Return safe defaults
            return new EnvironmentConfig
            {
                ApiBaseUrl = "http://10.0.2.2:5215",
                IdentityBaseUrl = "http://10.0.2.2:7122",
                EnableLogging = true,
                CacheTimeout = 300,
                RequestTimeout = 30,
                RetryCount = 3
            };
        }
    }

    private static string GetEnvironmentName()
    {
#if DEBUG
        return "Development";
#elif STAGING
        return "Staging";
#else
        return "Production";
#endif
    }

    private static string LoadEnvironmentJson()
    {
        using var stream = FileSystem.OpenAppPackageFileAsync("environments.json").Result;
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}

/// <summary>
/// Provides device push notification token for FCM registration
/// </summary>
public interface INotificationDeviceTokenProvider
{
    /// <summary>
    /// Get the current device token for push notifications
    /// </summary>
    /// <returns>Device token or null if unavailable</returns>
    Task<string?> GetDeviceTokenAsync();
    
    /// <summary>
    /// Get the platform identifier ("android" or "ios")
    /// </summary>
    string Platform { get; }
}

/// <summary>
/// Stub implementation of device token provider for development
/// </summary>
public class StubNotificationDeviceTokenProvider : INotificationDeviceTokenProvider
{
    public string Platform => 
#if ANDROID
        "android";
#elif IOS
        "ios";
#else
        "android"; // Default for Windows/testing
#endif

    public Task<string?> GetDeviceTokenAsync()
    {
        // Generate a consistent test token based on device info
        var deviceId = DeviceInfo.Current.Idiom.ToString();
        var testToken = $"test_device_token_{Platform}_{deviceId}_{DateTime.UtcNow:yyyyMMdd}";
        
        return Task.FromResult<string?>(testToken);
    }
}

/// <summary>
/// Service for managing notification badge count
/// </summary>
public interface INotificationsBadgeService
{
    int UnreadCount { get; }
    event EventHandler<int>? UnreadCountChanged;
    Task RefreshUnreadCountAsync(CancellationToken ct = default);
    void SetUnreadCount(int count);
}

/// <summary>
/// Implementation of notifications badge service
/// </summary>
public class NotificationsBadgeService : INotificationsBadgeService
{
    private readonly INotificationsApiClient _notificationsApi;
    private int _unreadCount;

    public int UnreadCount 
    { 
        get => _unreadCount;
        private set
        {
            if (_unreadCount != value)
            {
                _unreadCount = value;
                UnreadCountChanged?.Invoke(this, value);
            }
        }
    }

    public event EventHandler<int>? UnreadCountChanged;

    public NotificationsBadgeService(INotificationsApiClient notificationsApi)
    {
        _notificationsApi = notificationsApi;
    }

    public async Task RefreshUnreadCountAsync(CancellationToken ct = default)
    {
        try
        {
            var result = await _notificationsApi.GetUnreadCountAsync(ct);
            SetUnreadCount(result.unreadCount);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[BadgeService] Failed to refresh unread count: {ex.Message}");
        }
    }

    public void SetUnreadCount(int count)
    {
        UnreadCount = Math.Max(0, count);
    }
}
