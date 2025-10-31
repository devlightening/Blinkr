using Microsoft.Maui.Controls.Maps;
using Microsoft.Maui.Maps;
using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features;

public partial class MapPage : ContentPage
{
    private readonly IApiClient? _apiClient;
    private readonly IGeolocation _geolocation;

    // Constructor with DI
    public MapPage(IApiClient? apiClient = null, IGeolocation? geolocation = null)
    {
        InitializeComponent();
        
        _apiClient = apiClient;
        _geolocation = geolocation ?? Geolocation.Default;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        
        // Initialize map when page appears
        await InitializeMapAsync();
    }

    private async Task InitializeMapAsync()
    {
        try
        {
            // Get user's current location
            var location = await _geolocation.GetLocationAsync(new GeolocationRequest
            {
                DesiredAccuracy = GeolocationAccuracy.Medium,
                Timeout = TimeSpan.FromSeconds(10)
            });

            if (location != null)
            {
                // Center map on user's location
                var position = new Location(location.Latitude, location.Longitude);
                BlinkrMap.MoveToRegion(MapSpan.FromCenterAndRadius(position, Distance.FromKilometers(2)));
                
                // Load nearby posts
                await LoadNearbyPostsAsync(location.Latitude, location.Longitude);
            }
            else
            {
                // Fallback to Istanbul
                var istanbul = new Location(41.0082, 28.9784);
                BlinkrMap.MoveToRegion(MapSpan.FromCenterAndRadius(istanbul, Distance.FromKilometers(5)));
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Map initialization error: {ex.Message}");
            
            // Fallback to Istanbul on error
            var istanbul = new Location(41.0082, 28.9784);
            BlinkrMap.MoveToRegion(MapSpan.FromCenterAndRadius(istanbul, Distance.FromKilometers(5)));
        }
    }

    private async Task LoadNearbyPostsAsync(double lat, double lon)
    {
        if (_apiClient == null) return;

        try
        {
            var posts = await _apiClient.GetNearbyAsync(lat, lon, radius: 5000, page: 1, pageSize: 20);
            
            // TODO: Add pins to map for each post
            foreach (var post in posts.Items)
            {
                // Add map pins here when we have location data
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading nearby posts: {ex.Message}");
        }
    }
}
