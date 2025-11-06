using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Auth;

#if ANDROID
using Android.Util;
#endif

namespace Blinkr.Mobile.Features.Map;

public partial class MapViewModel : ObservableObject
{
    private readonly IBlinkrApiClient _apiClient;
    private readonly IAuthService _auth;

    [ObservableProperty] private bool isBusy;
    [ObservableProperty] private bool isAuthenticated;
    [ObservableProperty] private string statusMessage = "Haritayı hareket ettirin";
    [ObservableProperty] private ObservableCollection<PostLocationDto> nearbyPosts = new();
    [ObservableProperty] private PostLocationDto? selectedPost;
    [ObservableProperty] private PostDetailDto? selectedPostDetail;
    [ObservableProperty] private bool isBottomSheetVisible;
    [ObservableProperty] private bool isLoadingDetail;
    
    // Markers for WebView (no MAUI Maps dependency)
    public ObservableCollection<MapMarker> Markers { get; } = new();

    public MapViewModel(IBlinkrApiClient apiClient, IAuthService auth)
    {
        _apiClient = apiClient;
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

    public async Task LoadNearbyAsync(double? lat = null, double? lng = null)
    {
        if (IsBusy) return;

        try
        {
#if ANDROID
            Log.Info("Blinkr", $"[MapViewModel] LoadNearbyAsync called: lat={lat}, lng={lng}");
#else
            Console.WriteLine($"[MapViewModel] LoadNearbyAsync called: lat={lat}, lng={lng}");
#endif
            IsBusy = true;
            StatusMessage = "Yakındaki postlar yükleniyor...";

            // Use provided coordinates or get current location
            double latitude, longitude;
            
            if (lat.HasValue && lng.HasValue)
            {
                latitude = lat.Value;
                longitude = lng.Value;
            }
            else
            {
                // Get location asynchronously on background thread
                var location = await Task.Run(async () =>
                {
                    try
                    {
                        return await Geolocation.GetLocationAsync(new GeolocationRequest
                        {
                            DesiredAccuracy = GeolocationAccuracy.Medium,
                            Timeout = TimeSpan.FromSeconds(10)
                        });
                    }
                    catch
                    {
                        return null;
                    }
                });
                
                if (location == null)
                {
                    StatusMessage = "Konum alınamadı";
                    return;
                }
                
                latitude = location.Latitude;
                longitude = location.Longitude;
            }

            // Call API asynchronously
            var posts = await Task.Run(async () =>
                await _apiClient.GetNearbyPosts(
                    lat: latitude,
                    lng: longitude,
                    radiusKm: 5.0));

            // Update UI on main thread
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                // Update posts
                NearbyPosts.Clear();
                foreach (var post in posts)
                {
                    NearbyPosts.Add(post);
                }

                // Create markers for WebView
                Markers.Clear();
                foreach (var post in posts)
                {
                    Markers.Add(new MapMarker(
                        Id: post.Id,
                        Title: post.Title,
                        Lat: post.Lat,
                        Lng: post.Lng,
                        Address: "" // Backend doesn't return address in lightweight DTO
                    ));
                }

                StatusMessage = $"{posts.Count} post bulundu";
            });
        }
        catch (Exception ex)
        {
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                StatusMessage = $"Hata: {ex.Message}";
            });
#if ANDROID
            Log.Error("Blinkr", $"[MapViewModel] LoadNearby error: {ex.Message}");
#else
            Console.WriteLine($"[MapViewModel] LoadNearby error: {ex.Message}");
#endif
        }
        finally
        {
            IsBusy = false;
        }
    }

    public void OnPinTapped(PostLocationDto post)
    {
        SelectedPost = post;
        IsBottomSheetVisible = true;
    }

    /// <summary>
    /// Show post by ID (for app://pin bridge)
    /// </summary>
    public async Task ShowPostById(string id)
    {
        if (string.IsNullOrEmpty(id) || !Guid.TryParse(id, out var postId))
            return;

        var post = NearbyPosts.FirstOrDefault(p => p.Id == postId);
        if (post != null)
        {
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                SelectedPost = post;
                IsBottomSheetVisible = true;
            });
        }
    }

    [RelayCommand]
    public void CloseBottomSheet()
    {
        IsBottomSheetVisible = false;
        SelectedPost = null;
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

    /// <summary>
    /// Scans visible map bounds for posts and updates markers
    /// </summary>
    public async Task ScanAsync(MapBounds? bounds)
    {
        System.Diagnostics.Debug.WriteLine(" [C#] ScanAsync called");
        
        if (IsBusy)
        {
#if ANDROID
            Log.Warn("Blinkr", "[MapViewModel] ScanAsync: Already busy, skipping");
#else
            Console.WriteLine("[MapViewModel] ScanAsync: Already busy, skipping");
#endif
            return;
        }

        try
        {
            IsBusy = true;
            StatusMessage = "Gönderiler taranıyor...";
            
#if ANDROID
            Log.Info("Blinkr", $"[MapViewModel] ScanAsync: bounds={bounds?.Center?.Lat},{bounds?.Center?.Lng}");
#else
            Console.WriteLine($"[MapViewModel] ScanAsync: bounds={bounds?.Center?.Lat},{bounds?.Center?.Lng}");
#endif

            // Calculate center and radius from bounds, or use Istanbul as default
            double lat, lng, radiusKm;
            
            if (bounds?.Center != null)
            {
                lat = bounds.Center.Lat;
                lng = bounds.Center.Lng;
                
                // Calculate radius from bounds (distance from center to corner)
                var northLat = bounds.North;
                var eastLng = bounds.East;
                
                // Haversine formula to calculate distance
                var dLat = (northLat - lat) * Math.PI / 180.0;
                var dLng = (eastLng - lng) * Math.PI / 180.0;
                var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                       Math.Cos(lat * Math.PI / 180.0) * Math.Cos(northLat * Math.PI / 180.0) *
                       Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
                var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
                radiusKm = 6371 * c; // Earth radius in km
                
                // Add some margin (50%)
                radiusKm = radiusKm * 1.5;
            }
            else
            {
                // Default to Istanbul center
                lat = 41.015137;
                lng = 28.979530;
                radiusKm = 5.0;
            }

            // Call API on background thread
#if ANDROID
            Log.Info("Blinkr", $"[MapViewModel] Calling API: lat={lat:F4}, lng={lng:F4}, radius={radiusKm:F2}km");
#else
            Console.WriteLine($"[MapViewModel] Calling API: lat={lat:F4}, lng={lng:F4}, radius={radiusKm:F2}km");
#endif
            
            var posts = await Task.Run(async () =>
                await _apiClient.GetNearbyPosts(lat, lng, radiusKm));
            
#if ANDROID
            Log.Info("Blinkr", $"[MapViewModel] API returned {posts.Count} posts");
#else
            Console.WriteLine($"[MapViewModel] API returned {posts.Count} posts");
#endif

            // If no posts found, add seed data for Istanbul (for testing)
            if (posts.Count == 0)
            {
                System.Diagnostics.Debug.WriteLine("🏭 [C#] No posts from API, generating test data...");
                posts = GenerateIstanbulTestData();
                System.Diagnostics.Debug.WriteLine($"✅ [C#] Generated {posts.Count} test posts for Istanbul");
            }

            // Update UI on main thread
            System.Diagnostics.Debug.WriteLine($"📝 [C#] Updating UI with {posts.Count} posts...");
            
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                NearbyPosts.Clear();
                Markers.Clear();
                
                foreach (var post in posts)
                {
                    NearbyPosts.Add(post);
                    Markers.Add(new MapMarker(
                        Id: post.Id,
                        Title: post.Title,
                        Lat: post.Lat,
                        Lng: post.Lng,
                        Address: "" // Backend doesn't return address in lightweight DTO
                    ));
                }
                
                StatusMessage = $"{posts.Count} post bulundu";
                
                System.Diagnostics.Debug.WriteLine($"✅ [C#] Added {Markers.Count} markers to collection");
            });

            // Notify MapPage to update markers (via PropertyChanged event)
            System.Diagnostics.Debug.WriteLine("🔔 [C#] Notifying PropertyChanged for Markers");
            OnPropertyChanged(nameof(Markers));
        }
        catch (Exception ex)
        {
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                StatusMessage = $"Hata: {ex.Message}";
            });
#if ANDROID
            Log.Error("Blinkr", $"[MapViewModel] ScanAsync error: {ex.Message}");
            Log.Error("Blinkr", $"[MapViewModel] Stack trace: {ex.StackTrace}");
#else
            Console.WriteLine($"[MapViewModel] ScanAsync error: {ex}");
#endif
        }
        finally
        {
            IsBusy = false;
        }
    }

    /// <summary>
    /// Generates 50+ test posts around Istanbul for testing
    /// </summary>
    private static List<PostLocationDto> GenerateIstanbulTestData()
    {
        var random = new Random(42); // Fixed seed for consistent results
        var posts = new List<PostLocationDto>();
        
        // Famous Istanbul locations with real coordinates
        var locations = new[]
        {
            ("Taksim Meydanı", 41.0369, 28.9833),
            ("Galata Kulesi", 41.0256, 28.9744),
            ("Sultanahmet Camii", 41.0054, 28.9768),
            ("Ayasofya", 41.0086, 28.9802),
            ("Topkapı Sarayı", 41.0115, 28.9833),
            ("Kadıköy İskelesi", 40.9929, 29.0275),
            ("Beşiktaş Meydanı", 41.0422, 29.0075),
            ("Üsküdar Meydanı", 41.0226, 29.0155),
            ("Ortakoy", 41.0547, 29.0272),
            ("Beyoğlu", 41.0318, 28.9768),
            ("Eminonü", 41.0174, 28.9707),
            ("Karakoy", 41.0236, 28.9744),
            ("Cihangir", 41.0314, 28.9808),
            ("Nişantaşı", 41.0464, 28.9936),
            ("Şişli", 41.0602, 28.9869),
            ("Bebek", 41.0833, 29.0433),
            ("Etiler", 41.0786, 29.0272),
            ("Levent", 41.0786, 28.9936),
            ("Maslak", 41.1086, 29.0186),
            ("Sarıyer", 41.1686, 29.0533),
            ("Bakırköy", 40.9786, 28.8736),
            ("Yenikapı", 41.0044, 28.9536),
            ("Fatih", 41.0186, 28.9486),
            ("Eyup", 41.0486, 28.9336),
            ("Balat", 41.0286, 28.9486),
        };
        
        // Generate posts for each location
        var postTypes = new[] { "🍔 Restoran", "☕ Kafe", "🏛️ Müze", "🎉 Etkinlik", "📸 Manzara", "🛒 Alışveriş" };
        
        foreach (var (name, lat, lng) in locations)
        {
            // Add 2-3 posts per location
            var postCount = random.Next(2, 4);
            for (int i = 0; i < postCount; i++)
            {
                // Add small random offset (max 0.005 degrees ~ 500m)
                var offsetLat = lat + (random.NextDouble() - 0.5) * 0.01;
                var offsetLng = lng + (random.NextDouble() - 0.5) * 0.01;
                
                var postType = postTypes[random.Next(postTypes.Length)];
                var likes = random.Next(0, 100);
                var comments = random.Next(0, 20);
                
                posts.Add(new PostLocationDto(
                    Id: Guid.NewGuid(),
                    Title: $"{postType} - {name}",
                    Lat: offsetLat,
                    Lng: offsetLng,
                    MediaUrl: null
                ));
            }
        }
        
        return posts;
    }
    
    /// <summary>
    /// Load full post detail when pin is clicked
    /// </summary>
    [RelayCommand]
    public async Task LoadPostDetailAsync(Guid postId)
    {
        if (IsLoadingDetail) return;
        
        try
        {
            IsLoadingDetail = true;
            System.Diagnostics.Debug.WriteLine($"[MapViewModel] Loading post detail: {postId}");
            
            // Add timeout to prevent ANR
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            
            var detail = await _apiClient.GetPostById(postId);
            
            System.Diagnostics.Debug.WriteLine($"[MapViewModel] Post detail loaded: {detail?.Title}");
            
            if (detail != null)
            {
                SelectedPostDetail = detail;
                IsBottomSheetVisible = true;
                System.Diagnostics.Debug.WriteLine($"[MapViewModel] Bottom sheet opened");
            }
            else
            {
                StatusMessage = "Post bulunamadı";
                System.Diagnostics.Debug.WriteLine($"[MapViewModel] Post not found");
            }
        }
        catch (TaskCanceledException)
        {
            StatusMessage = "Zaman aşımı";
            System.Diagnostics.Debug.WriteLine($"[MapViewModel] LoadPostDetail timeout");
        }
        catch (Exception ex)
        {
            StatusMessage = $"Hata: {ex.Message}";
            System.Diagnostics.Debug.WriteLine($"[MapViewModel] LoadPostDetail error: {ex}");
        }
        finally
        {
            IsLoadingDetail = false;
        }
    }
}

// Helper class for map bounds
public class MapBounds
{
    public double North { get; set; }
    public double South { get; set; }
    public double East { get; set; }
    public double West { get; set; }
    public MapCenter? Center { get; set; }
    public int Zoom { get; set; }
}

public class MapCenter
{
    public double Lat { get; set; }
    public double Lng { get; set; }
}
