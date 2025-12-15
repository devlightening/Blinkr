using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Auth;

namespace Blinkr.Mobile.Features.Auth;

public partial class LoginPage : ContentPage
{
    private readonly IAuthApiClient _authApiClient;
    private readonly IAuthService _authService;

    public LoginPage(IAuthApiClient authApiClient, IAuthService authService)
    {
        InitializeComponent();
        _authApiClient = authApiClient;
        _authService = authService;
    }

    private async void OnLoginClicked(object sender, EventArgs e)
    {
        var email = EmailEntry.Text?.Trim();
        var password = PasswordEntry.Text?.Trim();

        // Validation
        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
        {
            ShowError("E-posta ve şifre gereklidir");
            return;
        }

        try
        {
            LoadingIndicator.IsRunning = true;
            LoadingIndicator.IsVisible = true;
            LoginButton.IsEnabled = false;
            ErrorLabel.IsVisible = false;

            // Call login API
            var response = await _authApiClient.LoginAsync(new LoginRequest(email, password));

            if (response?.Token != null)
            {
                // Store token
                await _authService.SaveTokenAsync(response.Token, response.RefreshToken);

                // Rebuild AppShell to show main tabs
                if (Shell.Current is AppShell appShell)
                {
                    appShell.RebuildUI();
                }
            }
            else
            {
                ShowError("Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
            }
        }
        catch (Exception ex)
        {
            ShowError($"Hata: {ex.Message}");
        }
        finally
        {
            LoadingIndicator.IsRunning = false;
            LoadingIndicator.IsVisible = false;
            LoginButton.IsEnabled = true;
        }
    }

    private async void OnRegisterTapped(object sender, TappedEventArgs e)
    {
        // Navigate to register page
        await Shell.Current.GoToAsync("register");
    }

    private void ShowError(string message)
    {
        ErrorLabel.Text = message;
        ErrorLabel.IsVisible = true;
    }
}
