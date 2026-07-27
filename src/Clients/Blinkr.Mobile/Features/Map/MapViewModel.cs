using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Auth;
using Blinkr.Mobile.Core.Services;

#if ANDROID
using Android.Util;
#endif

namespace Blinkr.Mobile.Features.Map;

public class MapPostDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string AuthorName { get; set; } = "";
    public int LikeCount { get; set; }
    public int CommentCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? Gender { get; set; } // "Male" / "Female" / null
}

public class MapPostItem
{
    public Guid PostId { get; set; }
    public string UserName { get; set; } = "";
    public string Title { get; set; } = "";
    public string Summary { get; set; } = "";
    public double DistanceKm { get; set; }
    public int Likes { get; set; }
    public int Comments { get; set; }
    public int Shares { get; set; }
    public bool IsLikedByCurrentUser { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

public partial class MapViewModel : ObservableObject
{
    private readonly IBlinkrApiClient _apiClient;
    private readonly IAuthService _auth;
    private readonly INotificationsBadgeService? _badgeService;

    [ObservableProperty] private bool isBusy;
    [ObservableProperty] private bool isAuthenticated;
    [ObservableProperty] private string statusMessage = "Haritayı hareket ettirin";
    [ObservableProperty] private ObservableCollection<PostLocationDto> nearbyPosts = new();
    [ObservableProperty] private PostLocationDto? selectedPost;
    [ObservableProperty] private PostDetailDto? selectedPostDetail;
    [ObservableProperty] private bool isBottomSheetVisible = false; // Start closed
    [ObservableProperty] private bool isLoadingDetail;
    [ObservableProperty] private int unreadNotificationsCount;
    
    // Modern UI properties
    [ObservableProperty] private ObservableCollection<MapPostItem> modernNearbyPosts = new();
    [ObservableProperty] private MapPostItem? modernSelectedPost;
    
    // Markers for WebView (no MAUI Maps dependency)
    public ObservableCollection<MapMarker> Markers { get; } = new();

    public MapViewModel(IBlinkrApiClient apiClient, IAuthService auth, INotificationsBadgeService? badgeService = null)
    {
        _apiClient = apiClient;
        _auth = auth;
        _badgeService = badgeService;
        
        // Subscribe to badge changes
        if (_badgeService != null)
        {
            _badgeService.UnreadCountChanged += OnUnreadCountChanged;
            UnreadNotificationsCount = _badgeService.UnreadCount;
        }
        
        // Check auth status on startup
        _ = CheckAuthStatusAsync();
    }

    [RelayCommand]
    public async Task LoginAsync()
    {
        // Navigate to login page instead of calling auth service directly
        try
        {
            await Shell.Current.GoToAsync("//login");
        }
        catch (Exception ex)
        {
            StatusMessage = $"Navigation error: {ex.Message}";
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

            // Call API with NOW feed (3 hours)
            var result = await Task.Run(async () =>
                await _apiClient.GetNearbyPosts(
                    lat: latitude,
                    lon: longitude,
                    radius: 5000,
                    sinceMinutes: 180)); // NOW feed: last 3 hours
                    
            var posts = result.Items.ToList();

            // Update UI on main thread
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                // Update posts - only add posts with valid coordinates
                NearbyPosts.Clear();
                Markers.Clear();
                
                foreach (var post in posts)
                {
                    // Only add posts that have both latitude and longitude
                    if (post.Latitude.HasValue && post.Longitude.HasValue)
                    {
                        NearbyPosts.Add(post);
                        Markers.Add(new MapMarker(
                            Id: post.Id,
                            Title: GetFreshnessTitle(post),
                            Lat: post.Latitude.Value,
                            Lng: post.Longitude.Value,
                            Address: GetFreshnessText(post),
                            Gender: post.Gender
                        ));
                    }
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

    [RelayCommand]
    public async Task LoadNearby()
    {
        await ScanAsync(null);
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
                
            // Refresh badge if authenticated
            if (IsAuthenticated)
            {
                _ = RefreshBadgeAsync(); // Fire and forget
            }
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
                // Default to Turkey center (for scanning all posts)
                lat = 39.0;
                lng = 35.0;
                radiusKm = 500.0; // 500km radius to cover entire Turkey
            }

            // Call API on background thread
#if ANDROID
            Log.Info("Blinkr", $"[MapViewModel] Calling API: lat={lat:F4}, lng={lng:F4}, radius={radiusKm:F2}km");
#else
            Console.WriteLine($"[MapViewModel] Calling API: lat={lat:F4}, lng={lng:F4}, radius={radiusKm:F2}km");
#endif
            
            List<PostLocationDto> posts = new();
            
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
                var result = await Task.Run(async () =>
                    await _apiClient.GetNearbyPosts(
                        lat: lat, 
                        lon: lng, 
                        radius: (int)(radiusKm * 1000), // Convert km to meters
                        sinceMinutes: 10080), // Get all posts (last 7 days)
                    cts.Token);
                        
                posts = result.Items.ToList();
                
#if ANDROID
                Log.Info("Blinkr", $"[MapViewModel] API returned {posts.Count} posts");
#else
                Console.WriteLine($"[MapViewModel] API returned {posts.Count} posts");
#endif
            }
            catch (OperationCanceledException)
            {
#if ANDROID
                Log.Warn("Blinkr", "[MapViewModel] API call timeout, using test data");
#else
                Console.WriteLine("[MapViewModel] API call timeout, using test data");
#endif
                posts = new();
            }
            catch (Exception apiEx)
            {
#if ANDROID
                Log.Warn("Blinkr", $"[MapViewModel] API call failed: {apiEx.Message}, using test data");
#else
                Console.WriteLine($"[MapViewModel] API call failed: {apiEx.Message}, using test data");
#endif
                posts = new();
            }

            // Don't generate test data - use only API results
            // If API returns 0 posts, that's valid (no posts in this area)

            // Update UI on main thread
            System.Diagnostics.Debug.WriteLine($"📝 [C#] Updating UI with {posts.Count} posts...");
            
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                // Don't close bottom sheet if it's already open (user clicked a pin)
                // Only clear if bottom sheet is not visible
                if (!IsBottomSheetVisible)
                {
                    SelectedPost = null;
                    SelectedPostDetail = null;
                }
                
                NearbyPosts.Clear();
                Markers.Clear();
                
                // Filter posts: only show posts with valid coordinates
                foreach (var post in posts)
                {
                    // Only add posts that have both latitude and longitude
                    if (post.Latitude.HasValue && post.Longitude.HasValue)
                    {
                        NearbyPosts.Add(post);
                        Markers.Add(new MapMarker(
                            Id: post.Id,
                            Title: GetFreshnessTitle(post),
                            Lat: post.Latitude.Value,
                            Lng: post.Longitude.Value,
                            Address: GetFreshnessText(post),
                            Gender: post.Gender
                        ));
                    }
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
            var errorMessage = ex.Message.Contains("Connection") || ex.Message.Contains("network") || ex.Message.Contains("refused")
                ? "Sunucuya bağlanılamıyor. Gateway'in çalıştığından emin olun (port 5100)."
                : $"Hata: {ex.Message}";
            
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                StatusMessage = errorMessage;
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
        var genders = new[] { "Male", "Female", "Other" };
        
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
                
                // Generate random freshness (0-180 minutes ago)
                var minutesAgo = random.Next(0, 180);
                var createdAt = DateTime.UtcNow.AddMinutes(-minutesAgo);
                var freshnessSec = minutesAgo * 60;
                var isLive = freshnessSec <= 3600; // Last hour
                
                posts.Add(new PostLocationDto(
                    Id: Guid.NewGuid(),
                    Title: $"{postType} - {name}",
                    Latitude: offsetLat,
                    Longitude: offsetLng,
                    CreatedAtUtc: createdAt,
                    FreshnessSec: freshnessSec,
                    IsLive: isLive,
                    MediaUrl: null,
                    DistanceMeters: null,
                    Gender: genders[random.Next(genders.Length)]
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
            
            // Find post from nearby posts first (for quick display)
            var post = NearbyPosts.FirstOrDefault(p => p.Id == postId);
            if (post != null)
            {
                SelectedPost = post;
                System.Diagnostics.Debug.WriteLine($"[MapViewModel] Found local post: {post.Title}");
            }
            
            // Always load full detail from API on background thread
            PostDetailDto? detail = null;
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
                detail = await Task.Run(async () =>
                    await _apiClient.GetPostById(postId), cts.Token);
                
                System.Diagnostics.Debug.WriteLine($"[MapViewModel] Post detail loaded: {detail?.Title}");
            }
            catch (OperationCanceledException)
            {
                System.Diagnostics.Debug.WriteLine($"[MapViewModel] LoadPostDetail timeout");
                StatusMessage = "Post yükleme zaman aşımı";
                IsBottomSheetVisible = false;
            }
            catch (Exception detailEx)
            {
                System.Diagnostics.Debug.WriteLine($"[MapViewModel] LoadPostDetail error: {detailEx.Message}");
                StatusMessage = $"Post yükleme hatası: {detailEx.Message}";
                IsBottomSheetVisible = false;
            }
            
            if (detail != null)
            {
                SelectedPostDetail = detail;
                IsBottomSheetVisible = true;
                System.Diagnostics.Debug.WriteLine($"[MapViewModel] Bottom sheet opened with API post - LikeCount: {detail.LikeCount}, CommentCount: {detail.CommentCount}");
            }
            else if (SelectedPost != null)
            {
                // API failed but we have local post - show it anyway
                IsBottomSheetVisible = true;
                System.Diagnostics.Debug.WriteLine($"[MapViewModel] Bottom sheet opened with local post (API failed)");
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
            IsBottomSheetVisible = false;
        }
        catch (Exception ex)
        {
            StatusMessage = $"Hata: {ex.Message}";
            System.Diagnostics.Debug.WriteLine($"[MapViewModel] LoadPostDetail error: {ex}");
            IsBottomSheetVisible = false;
        }
        finally
        {
            IsLoadingDetail = false;
        }
    }
    
    /// <summary>
    /// Get post title with freshness indicator
    /// </summary>
    private string GetFreshnessTitle(PostLocationDto post)
    {
        var indicator = post.IsLive ? "🔴" : "📍";
        return $"{indicator} {post.Title}";
    }
    
    /// <summary>
    /// Get human-readable freshness text
    /// </summary>
    private string GetFreshnessText(PostLocationDto post)
    {
        if (!post.FreshnessSec.HasValue)
            return "";
            
        var seconds = post.FreshnessSec.Value;
        
        if (seconds < 60)
            return "Az önce";
        else if (seconds < 3600)
            return $"{seconds / 60} dk önce";
        else if (seconds < 86400)
            return $"{seconds / 3600} sa önce";
        else
            return $"{seconds / 86400} gün önce";
    }
    
    /// <summary>
    /// Handle unread count changes from badge service
    /// </summary>
    private void OnUnreadCountChanged(object? sender, int count)
    {
        MainThread.BeginInvokeOnMainThread(() =>
        {
            UnreadNotificationsCount = count;
        });
    }
    
    /// <summary>
    /// Refresh badge count (call after login)
    /// </summary>
    public async Task RefreshBadgeAsync()
    {
        if (_badgeService != null)
        {
            await _badgeService.RefreshUnreadCountAsync();
        }
    }

    // Modern UI Commands for WS-09D
    [RelayCommand]
    public async Task RefreshModernAsync()
    {
        await LoadModernDummyAsync();
    }

    [RelayCommand]
    public void CenterOnUser()
    {
        // Platform-specific implementation later
    }

    [RelayCommand]
    public void ToggleLike()
    {
        if (ModernSelectedPost == null) return;
        ModernSelectedPost.Likes += ModernSelectedPost.IsLikedByCurrentUser ? -1 : 1;
        ModernSelectedPost.IsLikedByCurrentUser = !ModernSelectedPost.IsLikedByCurrentUser;
        OnPropertyChanged(nameof(ModernSelectedPost));
    }

    [RelayCommand]
    public async Task OpenComments()
    {
        if (ModernSelectedPost == null) return;
        await Shell.Current.DisplayAlert("Yorum", $"Post: {ModernSelectedPost.Title}", "Kapat");
    }

    [RelayCommand]
    public async Task OpenDirections()
    {
        if (ModernSelectedPost == null) return;
        var uri = $"https://www.google.com/maps/?q={ModernSelectedPost.Latitude},{ModernSelectedPost.Longitude}";
        await Launcher.OpenAsync(uri);
    }

    public async Task InitializeModernAsync()
    {
        if (ModernNearbyPosts.Count == 0)
            await LoadModernDummyAsync();
    }

    private async Task LoadModernDummyAsync()
    {
        IsBusy = true;

        try
        {
            await Task.Delay(500); // simulate network delay
            
            ModernNearbyPosts.Clear();
            
            // Dummy data
            ModernNearbyPosts.Add(new MapPostItem
            {
                PostId = Guid.NewGuid(),
                UserName = "testuser@blinkr.com",
                Title = "Moda Sahil'de gün batımı",
                Summary = "Kahvemi alıp sahilde oturuyorum. Hava mükemmel.",
                DistanceKm = 0.4,
                Likes = 12,
                Comments = 3,
                Latitude = 40.979,
                Longitude = 29.024
            });

            ModernNearbyPosts.Add(new MapPostItem
            {
                PostId = Guid.NewGuid(),
                UserName = "admin@blinkr.com",
                Title = "Kadıköy'de kahve molası",
                Summary = "Yeni açılan bir kafedeyim, ortam çok iyi.",
                DistanceKm = 1.2,
                Likes = 5,
                Comments = 1,
                Latitude = 40.987,
                Longitude = 29.030
            });

            ModernNearbyPosts.Add(new MapPostItem
            {
                PostId = Guid.NewGuid(),
                UserName = "user123@blinkr.com",
                Title = "Beşiktaş'ta yeni mekan keşfi",
                Summary = "Harika bir restoran buldum, tavsiye ederim!",
                DistanceKm = 2.1,
                Likes = 28,
                Comments = 7,
                Latitude = 41.047,
                Longitude = 29.000
            });

            ModernSelectedPost = ModernNearbyPosts.FirstOrDefault();
        }
        finally
        {
            IsBusy = false;
        }
    }

    // API-based commands for WS-09D
    [RelayCommand]
    public async Task LoadNearbyPostsAsync()
    {
        if (IsBusy) return;
        IsBusy = true;

        try
        {
            // TODO: Backend endpoint'ini çağır
            // var result = await _apiClient.GetNearbyPostsAsync(lat, lng, radius);
            // ModernNearbyPosts = new ObservableCollection<MapPostItem>(result);
            // ModernSelectedPost = ModernNearbyPosts.FirstOrDefault();

            // Şimdilik dummy data
            await LoadModernDummyAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"❌ Error loading nearby posts: {ex.Message}");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    public Task LikePostAsync(MapPostItem? post)
    {
        if (post == null) return Task.CompletedTask;

        try
        {
            // TODO: Backend endpoint'ini çağır
            // await _apiClient.LikePostAsync(post.PostId);
            
            // Optimistic update
            post.Likes += post.IsLikedByCurrentUser ? -1 : 1;
            post.IsLikedByCurrentUser = !post.IsLikedByCurrentUser;
            OnPropertyChanged(nameof(ModernSelectedPost));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"❌ Error liking post: {ex.Message}");
        }

        return Task.CompletedTask;
    }

}




