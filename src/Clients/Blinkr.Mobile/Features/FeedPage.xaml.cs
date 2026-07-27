using System.Collections.ObjectModel;
using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Features.Services;

namespace Blinkr.Mobile.Features;

public class FeedViewModel
{
    private readonly IFeedFilterService _filterService;
    private readonly IPostMapper _postMapper;
    public ObservableCollection<PostItem> Posts { get; set; } = new();
    public bool IsLoading { get; set; }
    private string _currentFilter = "Yakın";

    public FeedViewModel(IFeedFilterService filterService, IPostMapper postMapper)
    {
        _filterService = filterService ?? throw new ArgumentNullException(nameof(filterService));
        _postMapper = postMapper ?? throw new ArgumentNullException(nameof(postMapper));
    }

    public async Task OnFilterClickedAsync(string filterName)
    {
        _currentFilter = filterName;
        await LoadDataAsync();
    }

    private async Task LoadDataAsync()
    {
        try
        {
            IsLoading = true;
            Posts.Clear();
            PagedResult<PostListDto>? result = null;

            result = _currentFilter switch
            {
                "Yakın" => await _filterService.GetNearbyAsync(page: 1, pageSize: 20),
                "Popüler" => await _filterService.GetPopularAsync(page: 1, pageSize: 20),
                "Yeni" => await _filterService.GetNewAsync(page: 1, pageSize: 20),
                _ => new PagedResult<PostListDto>(new List<PostListDto>(), 0, 1, 20)
            };

            if (result?.Items != null)
            {
                foreach (var post in result.Items)
                {
                    Posts.Add(_postMapper.MapToPostItem(post));
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading posts: {ex.Message}");
        }
        finally
        {
            IsLoading = false;
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
        await _viewModel.OnFilterClickedAsync(button.Text);
    }
}

public class PostItem
{
    public Guid Id { get; set; }
    public Guid AuthorId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string LocationName { get; set; } = string.Empty;
    public string Distance { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int LikeCount { get; set; }
    public int CommentCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
