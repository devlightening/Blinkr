using Blinkr.Mobile.Core.Api;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Blinkr.Mobile.Features.Map;

public partial class PostBottomSheet : ContentView
{
    public static readonly BindableProperty PostProperty =
        BindableProperty.Create(nameof(Post), typeof(PostLocationDto), typeof(PostBottomSheet), null, propertyChanged: OnPostChanged);

    public PostLocationDto? Post
    {
        get => (PostLocationDto?)GetValue(PostProperty);
        set => SetValue(PostProperty, value);
    }

    public PostBottomSheetViewModel ViewModel { get; }

    public PostBottomSheet()
    {
        InitializeComponent();
        ViewModel = new PostBottomSheetViewModel();
        BindingContext = ViewModel;
    }

    private static void OnPostChanged(BindableObject bindable, object oldValue, object newValue)
    {
        if (bindable is PostBottomSheet sheet && newValue is PostLocationDto post)
        {
            sheet.ViewModel.UpdatePost(post);
        }
    }

    public async Task ShowAsync()
    {
        IsVisible = true;
        SheetFrame.TranslationY = 300;
        await SheetFrame.TranslateTo(0, 0, 300, Easing.CubicOut);
    }

    public async Task HideAsync()
    {
        await SheetFrame.TranslateTo(0, 300, 300, Easing.CubicIn);
        IsVisible = false;
    }
}

public partial class PostBottomSheetViewModel : ObservableObject
{
    [ObservableProperty] private string title = string.Empty;
    [ObservableProperty] private string locationText = string.Empty;
    [ObservableProperty] private string? mediaUrl;
    [ObservableProperty] private int likeCount;

    public void UpdatePost(PostLocationDto post)
    {
        Title = post.Title;
        LocationText = $"{post.Lat:F4}, {post.Lng:F4}";
        MediaUrl = post.MediaUrl;
        
        // Lightweight DTO doesn't have like count - will be loaded separately if needed
        LikeCount = 0;
    }

    [RelayCommand]
    private async Task LikeAsync()
    {
        // TODO: Implement like functionality
        LikeCount++;
        await Task.Delay(100); // Haptic feedback simulation
    }

    [RelayCommand]
    private async Task CommentAsync()
    {
        // TODO: Navigate to comments page
        await Shell.Current.DisplayAlert("Yorum", "Yorum özelliği yakında eklenecek.", "Tamam");
    }

    [RelayCommand]
    private async Task ShareAsync()
    {
        // TODO: Implement share functionality
        await Share.Default.RequestAsync(new ShareTextRequest
        {
            Text = $"{Title}\n\n{LocationText}",
            Title = "Blinkr'dan Paylaş"
        });
    }

    [RelayCommand]
    private async Task DirectionsAsync()
    {
        // TODO: Open maps app with directions
        await Shell.Current.DisplayAlert("Yol Tarifi", "Harita uygulaması açılacak.", "Tamam");
    }

}
