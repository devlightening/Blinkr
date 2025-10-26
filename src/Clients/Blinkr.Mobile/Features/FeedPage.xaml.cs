using System.Collections.ObjectModel;

namespace Blinkr.Mobile.Features;

public partial class FeedPage : ContentPage
{
    public ObservableCollection<PostItem> Posts { get; set; } = new();

    public FeedPage()
    {
        InitializeComponent();
        LoadSampleData();
        BindingContext = this;
    }

    private void LoadSampleData()
    {
        Posts = new ObservableCollection<PostItem>
        {
            new PostItem
            {
                Author = "Beyoğlu • 1.1 km",
                Title = "Sokak Lezzetleri Keşfi",
                Content = "Yeni bir mekan buldum!",
                Distance = "350 m",
                TimeAgo = "2s",
                LikeCount = "15"
            },
            new PostItem
            {
                Author = "Kadıköy • 2.3 km", 
                Title = "Sahil Yürüyüşü",
                Content = "Harika bir günbatımı manzarası.",
                Distance = "1.2 km",
                TimeAgo = "5dk",
                LikeCount = "42"
            },
            new PostItem
            {
                Author = "Üsküdar • 3.1 km",
                Title = "Tarihi Mekan",
                Content = "Çok güzel bir kahvehane keşfettim.",
                Distance = "2.1 km", 
                TimeAgo = "1sa",
                LikeCount = "8"
            }
        };
    }
}

public class PostItem
{
    public string Author { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Distance { get; set; } = string.Empty;
    public string TimeAgo { get; set; } = string.Empty;
    public string LikeCount { get; set; } = string.Empty;
}
