using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features;

public partial class CreatePage : ContentPage
{
    private readonly IApiClient? _apiClient;
    private readonly IGeolocation _geolocation;

    public CreatePage(IApiClient? apiClient = null, IGeolocation? geolocation = null)
    {
        InitializeComponent();
        _apiClient = apiClient;
        _geolocation = geolocation ?? Geolocation.Default;
    }

    private async void OnSelectMediaClicked(object sender, EventArgs e)
    {
        try
        {
            // TODO: Implement media picker
            await DisplayAlert("Medya Seçimi", "Medya seçimi özelliği yakında eklenecek.", "Tamam");
        }
        catch (Exception ex)
        {
            await DisplayAlert("Hata", $"Medya seçilirken hata oluştu: {ex.Message}", "Tamam");
        }
    }

    private async void OnPostClicked(object sender, EventArgs e)
    {
        if (string.IsNullOrWhiteSpace(TitleEntry.Text))
        {
            await DisplayAlert("Uyarı", "Lütfen bir başlık girin.", "Tamam");
            return;
        }

        if (_apiClient == null)
        {
            await DisplayAlert("Hata", "API bağlantısı mevcut değil.", "Tamam");
            return;
        }

        try
        {
            // Get current location
            Location? location = null;
            try
            {
                var request = new GeolocationRequest
                {
                    DesiredAccuracy = GeolocationAccuracy.Medium,
                    Timeout = TimeSpan.FromSeconds(10)
                };
                
                location = await _geolocation.GetLocationAsync(request);
                System.Diagnostics.Debug.WriteLine($"[CreatePage] Location obtained: {location?.Latitude}, {location?.Longitude}");
            }
            catch (Exception locEx)
            {
                System.Diagnostics.Debug.WriteLine($"[CreatePage] Location failed: {locEx.Message}");
                // Continue without location - not critical
            }

            // Create post with location
            var createRequest = new CreatePostRequest(
                Title: TitleEntry.Text.Trim(),
                Content: ContentEditor.Text?.Trim() ?? string.Empty,
                Latitude: location?.Latitude,
                Longitude: location?.Longitude,
                AccuracyMeters: location?.Accuracy,
                LocationName: null // Could be enhanced with reverse geocoding
            );

            var result = await _apiClient.CreatePostAsync(createRequest);
            
            if (result.Success)
            {
                await DisplayAlert("Başarılı", 
                    location != null 
                        ? "Gönderiniz konum bilgisiyle paylaşıldı!" 
                        : "Gönderiniz paylaşıldı!", 
                    "Tamam");
                
                // Clear form
                TitleEntry.Text = string.Empty;
                ContentEditor.Text = string.Empty;
                
                // Navigate back to map
                await Shell.Current.GoToAsync("//map");
            }
            else
            {
                await DisplayAlert("Hata", result.Message ?? "Gönderi paylaşılamadı.", "Tamam");
            }
        }
        catch (Exception ex)
        {
            await DisplayAlert("Hata", $"Gönderi paylaşılırken hata oluştu: {ex.Message}", "Tamam");
        }
    }

    private async void OnCancelClicked(object sender, EventArgs e)
    {
        // Navigate back to previous page
        await Shell.Current.GoToAsync("..");
    }
}
