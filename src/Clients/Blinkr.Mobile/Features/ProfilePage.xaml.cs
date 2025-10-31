using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features;

public partial class ProfilePage : ContentPage
{
    private readonly IApiClient? _apiClient;

    public ProfilePage(IApiClient? apiClient = null)
    {
        InitializeComponent();
        _apiClient = apiClient;
    }

    private async void OnSettingsClicked(object sender, EventArgs e)
    {
        // TODO: Navigate to settings page
        await DisplayAlert("Ayarlar", "Ayarlar sayfası yakında eklenecek.", "Tamam");
    }
}
