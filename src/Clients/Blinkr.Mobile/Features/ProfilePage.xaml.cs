using System.Collections.ObjectModel;
using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features;

public class ProfileViewModel
{
    private readonly IApiClient _apiClient;
    public UserProfile? CurrentUser { get; set; }
    public ObservableCollection<PostItem> UserPosts { get; set; } = new();
    public bool IsLoading { get; set; }

    public ProfileViewModel(IApiClient apiClient)
    {
        _apiClient = apiClient ?? throw new ArgumentNullException(nameof(apiClient));
    }

    public async Task LoadUserProfileAsync()
    {
        try
        {
            IsLoading = true;
            CurrentUser = new UserProfile
            {
                Id = Guid.NewGuid(),
                UserName = "Jaram Sabatt",
                Email = "user@example.com",
                PostCount = 124,
                FollowerCount = 2500,
                FollowingCount = 890
            };

            await LoadUserPostsAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading profile: {ex.Message}");
        }
        finally
        {
            IsLoading = false;
        }
    }

    private async Task LoadUserPostsAsync()
    {
        try
        {
            var result = await ApiClientExtensions.GetFeedAsync(_apiClient, page: 1, pageSize: 10, sort: "createdAt:desc");
            if (result?.Items != null)
            {
                UserPosts.Clear();
                foreach (var post in result.Items)
                {
                    UserPosts.Add(new PostItem
                    {
                        Id = post.Id,
                        AuthorName = post.AuthorName ?? "Anonim",
                        Title = post.Title,
                        Content = post.Content,
                        LikeCount = post.LikeCount,
                        CommentCount = post.CommentCount,
                        CreatedAtUtc = post.CreatedAt
                    });
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading user posts: {ex.Message}");
        }
    }
}

public class UserProfile
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int PostCount { get; set; }
    public int FollowerCount { get; set; }
    public int FollowingCount { get; set; }
}

public partial class ProfilePage : ContentPage
{
    private ProfileViewModel? _viewModel;

    public ProfilePage(ProfileViewModel viewModel)
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
            await _viewModel.LoadUserProfileAsync();
        }
    }

    private async void OnSettingsClicked(object sender, EventArgs e)
    {
        await Shell.Current.GoToAsync(nameof(SettingsPage));
    }
}
