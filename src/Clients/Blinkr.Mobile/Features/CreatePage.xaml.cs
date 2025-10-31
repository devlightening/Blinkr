using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features;

public partial class CreatePage : ContentPage
{
    private readonly IApiClient? _apiClient;

    public CreatePage(IApiClient? apiClient = null)
    {
        InitializeComponent();
        _apiClient = apiClient;
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

        try
        {
            // TODO: Implement post creation
            await DisplayAlert("Başarılı", "Gönderiniz paylaşıldı!", "Tamam");
            
            // Clear form
            TitleEntry.Text = string.Empty;
            ContentEditor.Text = string.Empty;
            
            // Navigate back to map
            await Shell.Current.GoToAsync("//map");
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
