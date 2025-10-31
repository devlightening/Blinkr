using System.Collections.ObjectModel;
using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features;

public partial class FeedPage : ContentPage
{
    private readonly IApiClient? _apiClient;
    public ObservableCollection<PostItem> Posts { get; set; } = new();
    private string _currentFilter = "Yakın";

    // Constructor with optional DI
    public FeedPage(IApiClient? apiClient = null)
    {
        InitializeComponent();
        
        _apiClient = apiClient;
        BindingContext = this;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        
        // Load data when page appears
        await LoadDataAsync();
    }

    private void OnFilterClicked(object sender, EventArgs e)
    {
        if (sender is not Button button) return;

        // Reset all buttons to inactive style
        BtnYakin.Style = Resources["TabButton"] as Style;
        BtnPopuler.Style = Resources["TabButton"] as Style;
        BtnYeni.Style = Resources["TabButton"] as Style;

        // Set clicked button to active style
        button.Style = Resources["TabButtonActive"] as Style;
        _currentFilter = button.Text;

        // Load data based on filter
        _ = LoadDataAsync();
    }

    private async Task LoadDataAsync()
    {
        if (_apiClient == null)
        {
            LoadSampleData();
            return;
        }

        try
        {
            Posts.Clear();
            PagedResult<PostListDto>? result = null;

            switch (_currentFilter)
            {
                case "Yakın":
                    // Get user location
                    var location = await Geolocation.GetLocationAsync(new GeolocationRequest
                    {
                        DesiredAccuracy = GeolocationAccuracy.Medium,
                        Timeout = TimeSpan.FromSeconds(10)
                    });

                    if (location != null)
                    {
                        result = await _apiClient.GetNearbyAsync(
                            lat: location.Latitude,
                            lon: location.Longitude,
                            radius: 5000,
                            page: 1,
                            pageSize: 20);
                    }
                    break;

                case "Popüler":
                    result = await ApiClientExtensions.GetFeedAsync(_apiClient, page: 1, pageSize: 20, sort: "likeCount:desc");
                    break;

                case "Yeni":
                    result = await ApiClientExtensions.GetFeedAsync(_apiClient, page: 1, pageSize: 20, sort: "createdAt:desc");
                    break;
            }

            if (result != null)
            {
                foreach (var post in result.Items)
                {
                    Posts.Add(new PostItem
                    {
                        LocationName = post.LocationName ?? "Bilinmeyen Konum",
                        Distance = post.DistanceMeters.HasValue 
                            ? FormatDistance(post.DistanceMeters.Value) 
                            : "",
                        Title = post.Title,
                        Content = post.Content,
                        LikeText = post.LikeCount > 0 ? $"{post.LikeCount} Beğeni" : "Beğen",
                        CommentText = "",
                        ShareText = "Yorum Paylaş"
                    });
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading posts: {ex.Message}");
            LoadSampleData();
        }
    }

    private string FormatDistance(double meters)
    {
        if (meters < 1000)
        {
            return $"{(int)meters} m";
        }
        else
        {
            return $"{meters / 1000:F1} km";
        }
    }

    private void LoadSampleData()
    {
        Posts.Clear();
        
        var samplePosts = new[]
        {
            new PostItem
            {
                LocationName = "Beyoğlu",
                Distance = "1.1 km",
                Title = "Sokak Lezzetleri Keşfi",
                Content = "Yeni bir mekan buldum!",
                LikeText = "Beğen",
                CommentText = "",
                ShareText = "Yorum Paylaş"
            },
            new PostItem
            {
                LocationName = "Beyoğlu",
                Distance = "1.1 km",
                Title = "Sokak Lezzetleri Keşfi",
                Content = "Yeni bir mekan buldum!",
                LikeText = "Beğen",
                CommentText = "",
                ShareText = "Yorum Paylaş"
            }
        };

        foreach (var post in samplePosts)
        {
            Posts.Add(post);
        }
    }
}

public class PostItem
{
    public string LocationName { get; set; } = string.Empty;
    public string Distance { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string LikeText { get; set; } = string.Empty;
    public string CommentText { get; set; } = string.Empty;
    public string ShareText { get; set; } = string.Empty;
    public string MapThumbnailUrl { get; set; } = string.Empty;
}
