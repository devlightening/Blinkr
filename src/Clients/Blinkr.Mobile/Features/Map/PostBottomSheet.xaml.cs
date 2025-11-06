using Blinkr.Mobile.Core.Api;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Blinkr.Mobile.Features.Map;

public partial class PostBottomSheet : ContentView
{
    public static readonly BindableProperty PostProperty =
        BindableProperty.Create(nameof(Post), typeof(PostDetailDto), typeof(PostBottomSheet), null, propertyChanged: OnPostChanged);

    public PostDetailDto? Post
    {
        get => (PostDetailDto?)GetValue(PostProperty);
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
        if (bindable is PostBottomSheet sheet && newValue is PostDetailDto post)
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
    [ObservableProperty] private string content = string.Empty;
    [ObservableProperty] private string authorName = string.Empty;
    [ObservableProperty] private string? authorAvatarUrl;
    [ObservableProperty] private string? locationName;
    [ObservableProperty] private string relativeTime = string.Empty;
    [ObservableProperty] private List<MediaDto>? media;
    [ObservableProperty] private int likeCount;
    [ObservableProperty] private int commentCount;
    
    public bool HasMedia => Media != null && Media.Count > 0;
    public bool HasLocation => !string.IsNullOrEmpty(LocationName);
    public bool HasAvatar => !string.IsNullOrEmpty(AuthorAvatarUrl);
    public bool HasNoAvatar => string.IsNullOrEmpty(AuthorAvatarUrl);

    public void UpdatePost(PostDetailDto post)
    {
        Title = post.Title;
        Content = post.Content;
        AuthorName = post.AuthorName ?? "Bilinmeyen";
        AuthorAvatarUrl = post.AuthorAvatarUrl;
        LocationName = post.LocationName;
        RelativeTime = GetRelativeTime(post.CreatedAt);
        Media = post.Media;
        LikeCount = post.LikeCount;
        CommentCount = post.CommentCount;
        
        OnPropertyChanged(nameof(HasMedia));
        OnPropertyChanged(nameof(HasLocation));
        OnPropertyChanged(nameof(HasAvatar));
        OnPropertyChanged(nameof(HasNoAvatar));
    }
    
    private static string GetRelativeTime(DateTime dateTime)
    {
        var timeSpan = DateTime.Now - dateTime;
        
        return timeSpan.TotalMinutes switch
        {
            < 1 => "Az önce",
            < 60 => $"{(int)timeSpan.TotalMinutes} dk önce",
            < 1440 => $"{(int)timeSpan.TotalHours} sa önce",
            < 10080 => $"{(int)timeSpan.TotalDays} gün önce",
            _ => dateTime.ToString("dd.MM.yyyy")
        };
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
            Text = $"{Title}\n\n{LocationName ?? ""}",
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
