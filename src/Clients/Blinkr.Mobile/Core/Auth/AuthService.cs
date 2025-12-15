using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Services;

namespace Blinkr.Mobile.Core.Auth;

public sealed class AuthService : IAuthService
{
    private readonly ITokenStore _tokenStore;
    private readonly INotificationsApiClient? _notificationsApi;
    private readonly INotificationDeviceTokenProvider? _tokenProvider;

    public AuthService(
        ITokenStore tokenStore,
        INotificationsApiClient? notificationsApi = null,
        INotificationDeviceTokenProvider? tokenProvider = null)
    {
        _tokenStore = tokenStore;
        _notificationsApi = notificationsApi;
        _tokenProvider = tokenProvider;
    }

    public async Task<string?> GetAccessTokenAsync()
    {
        return await _tokenStore.GetAccessTokenAsync();
    }

    public async Task<bool> IsAuthenticatedAsync()
    {
        var token = await GetAccessTokenAsync();
        return !string.IsNullOrEmpty(token);
    }

    public async Task SaveTokenAsync(string accessToken, string refreshToken)
    {
        await _tokenStore.SaveTokensAsync(accessToken, refreshToken);
    }

    public async Task<(bool IsSuccess, string? ErrorMessage)> RefreshTokenAsync(CancellationToken ct = default)
    {
        // This method is kept for backward compatibility
        // Actual refresh is handled by AuthMessageHandler or API client
        var refreshToken = await _tokenStore.GetRefreshTokenAsync();
        if (string.IsNullOrEmpty(refreshToken))
        {
            return (false, "No refresh token available");
        }
        return (true, null);
    }

    public async Task LogoutAsync()
    {
        await _tokenStore.ClearTokensAsync();
    }
    
    /// <summary>
    /// Register device token for push notifications (called after successful login)
    /// </summary>
    public async Task RegisterDeviceTokenAsync()
    {
        if (_notificationsApi == null || _tokenProvider == null)
        {
            System.Diagnostics.Debug.WriteLine("[AuthService] Notifications API or token provider not available");
            return;
        }
        
        try
        {
            var deviceToken = await _tokenProvider.GetDeviceTokenAsync();
            if (string.IsNullOrEmpty(deviceToken))
            {
                System.Diagnostics.Debug.WriteLine("[AuthService] No device token available");
                return;
            }
            
            var request = new DeviceTokenRequest(deviceToken, _tokenProvider.Platform);
            await _notificationsApi.RegisterDeviceTokenAsync(request);
            
            System.Diagnostics.Debug.WriteLine($"[AuthService] Device token registered: {_tokenProvider.Platform}");
        }
        catch (Exception ex)
        {
            // Don't break login flow if device token registration fails
            System.Diagnostics.Debug.WriteLine($"[AuthService] Device token registration failed: {ex.Message}");
        }
    }
}
