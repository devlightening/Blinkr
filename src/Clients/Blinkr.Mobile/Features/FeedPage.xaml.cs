using System.Collections.ObjectModel;
using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features;

public class FeedViewModel
{
    private readonly IApiClient? _apiClient;
    public ObservableCollection<PostItem> Posts { get; set; } = new();
    private string _currentFilter = "Yakın";

    public FeedViewModel(IApiClient? apiClient = null)
    {
        _apiClient = apiClient;
        LoadSampleData();
    }

    public async Task OnFilterClickedAsync(string filterName)
    {
        _currentFilter = filterName;
        await LoadDataAsync();
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
                LocationName = "Beyoğlu, İstanbul",
                Distance = "1.2 km",
                Title = "Harika bir kahve dükkanı buldum!",
                Content = "Çok güzel bir ortam ve lezzetli kahveler. Herkesin deneyebileceği bir yer!",
                LikeText = "24 Beğeni",
                CommentText = "",
                ShareText = "Yorum Paylaş"
            },
            new PostItem
            {
                LocationName = "Taksim, İstanbul",
                Distance = "2.5 km",
                Title = "Gün batımı manzarası müthiş",
                Content = "Boğaz'ın bu tarafından gün batımı görülüyor. Fotoğraf çekmek için ideal!",
                LikeText = "156 Beğeni",
                CommentText = "",
                ShareText = "Yorum Paylaş"
            },
            new PostItem
            {
                LocationName = "Galata, İstanbul",
                Distance = "0.8 km",
                Title = "Yeni açılan resepsiyon duydum",
                Content = "Galata'da yeni bir resepsiyon açılmış. Merakla bekliyorum açılışını!",
                LikeText = "42 Beğeni",
                CommentText = "",
                ShareText = "Yorum Paylaş"
            },
            new PostItem
            {
                LocationName = "Ortaköy, İstanbul",
                Distance = "3.1 km",
                Title = "Sahil yürüyüşü çok rahatlatıcı",
                Content = "Sabah erken saatlerde sahil yürüyüşü yapıyorum. Hava çok güzel!",
                LikeText = "89 Beğeni",
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

public partial class FeedPage : ContentPage
{
    private FeedViewModel? _viewModel;

    public FeedPage(FeedViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        BindingContext = viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        if (_viewModel != null)
        {
            await _viewModel.OnFilterClickedAsync("Yakın");
        }
    }

    private async void OnFilterClicked(object sender, EventArgs e)
    {
        if (sender is not Button button || _viewModel == null) return;

        // Reset all buttons to inactive style
        BtnYakin.Style = Resources["TabButton"] as Style;
        BtnPopuler.Style = Resources["TabButton"] as Style;
        BtnYeni.Style = Resources["TabButton"] as Style;

        // Set clicked button to active style
        button.Style = Resources["TabButtonActive"] as Style;

        // Load data based on filter
        await _viewModel.OnFilterClickedAsync(button.Text);
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
