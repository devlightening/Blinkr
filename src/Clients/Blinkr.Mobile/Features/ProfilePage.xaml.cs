namespace Blinkr.Mobile.Features;

public partial class ProfilePage : ContentPage
{
    public ProfilePage()
    {
        InitializeComponent();
    }

    private async void OnSettingsClicked(object sender, EventArgs e)
    {
        // TODO: Navigate to settings page
        await DisplayAlert("Ayarlar", "Ayarlar sayfası yakında eklenecek.", "Tamam");
    }
}
