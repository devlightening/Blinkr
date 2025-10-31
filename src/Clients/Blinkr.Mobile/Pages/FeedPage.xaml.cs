namespace Blinkr.Mobile.Pages;

public partial class FeedPage : ContentPage
{
    public FeedPage()
    {
        InitializeComponent();
        FeedList.ItemsSource = new[]
        {
            new { Title="Sokak Lezzetleri Keşfi", Subtitle="Yeni bir mekan buldum!", LikeCount="5k", Distance="1.1 km" },
            new { Title="Galata’ya Gün Batımı",    Subtitle="Çatılardan eşsiz manzara.", LikeCount="12k", Distance="350 m" }
        };
    }
}

