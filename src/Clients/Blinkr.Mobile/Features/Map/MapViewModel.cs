using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Auth;

namespace Blinkr.Mobile.Features.Map;

public partial class MapViewModel : ObservableObject
{
    private readonly IApiClient _api;
    private readonly IAuthService _auth;

    [ObservableProperty] private bool isBusy;
    [ObservableProperty] private bool isAuthenticated;
    [ObservableProperty] private string statusMessage = "Tap to load nearby posts";
    [ObservableProperty] private ObservableCollection<PostListDto> nearbyPosts = new();

    public MapViewModel(IApiClient api, IAuthService auth)
    {
        _api = api;
        _auth = auth;
        
        // Check auth status on startup
        _ = CheckAuthStatusAsync();
    }

    [RelayCommand]
    public async Task LoginAsync()
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            StatusMessage = "Logging in...";

            var success = await _auth.LoginAsync();
            if (success)
            {
                IsAuthenticated = true;
                StatusMessage = "Login successful! Tap to load nearby posts";
            }
            else
            {
                StatusMessage = "Login failed. Please try again.";
            }
        }
        catch (Exception ex)
        {
            StatusMessage = $"Login error: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    public async Task LoadNearbyAsync()
    {
        if (IsBusy) return;

        try
        {
            IsBusy = true;
            StatusMessage = "Getting location...";

            // Get current location
            Location? location = null;
            try
            {
                location = await Geolocation.GetLocationAsync(new GeolocationRequest
                {
                    DesiredAccuracy = GeolocationAccuracy.Medium,
                    Timeout = TimeSpan.FromSeconds(10)
                });
            }
            catch (FeatureNotEnabledException)
            {
                StatusMessage = "Konum servisi kapalı. Lütfen ayarlardan açın.";
                return;
            }
            catch (PermissionException)
            {
                StatusMessage = "Konum iznine ihtiyaç var. Lütfen izin verin.";
                return;
            }
            catch (Exception ex)
            {
                StatusMessage = $"Konum alınamadı: {ex.Message}";
                return;
            }

            if (location == null)
            {
                StatusMessage = "Konum bilgisi alınamadı. Tekrar deneyin.";
                return;
            }

            StatusMessage = "Loading nearby posts...";

            // Call API
            var result = await _api.GetNearbyAsync(
                lat: location.Latitude,
                lon: location.Longitude,
                radius: 5000,
                page: 1,
                pageSize: 15);

            // Update UI
            NearbyPosts.Clear();
            foreach (var post in result.Items)
            {
                NearbyPosts.Add(post);
            }

            StatusMessage = $"Found {result.Items.Count} nearby posts";
        }
        catch (HttpRequestException ex) when (ex.Message.Contains("429"))
        {
            StatusMessage = "Hız limiti aşıldı. Lütfen biraz bekleyip tekrar deneyin.";
        }
        catch (TaskCanceledException)
        {
            StatusMessage = "İstek zaman aşımına uğradı. İnternet bağlantınızı kontrol edin.";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Error loading posts: {ex.Message}";
            System.Diagnostics.Debug.WriteLine($"LoadNearby error: {ex}");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    public async Task LogoutAsync()
    {
        await _auth.LogoutAsync();
        IsAuthenticated = false;
        NearbyPosts.Clear();
        StatusMessage = "Logged out. Tap Login to continue.";
    }

    private async Task CheckAuthStatusAsync()
    {
        try
        {
            IsAuthenticated = await _auth.IsAuthenticatedAsync();
            StatusMessage = IsAuthenticated 
                ? "Ready! Tap to load nearby posts" 
                : "Tap Login to get started";
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Auth check error: {ex}");
            StatusMessage = "Tap Login to get started";
        }
    }
}
