using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Auth;
using Refit;

namespace Blinkr.Mobile.Pages;

public partial class LoginPage : ContentPage
{
    private readonly IAuthApiClient _authApiClient;
    private readonly ITokenStore _tokenStore;
    private readonly IAuthService _authService;

    public LoginPage(IAuthApiClient authApiClient, ITokenStore tokenStore, IAuthService authService)
    {
        InitializeComponent();
        _authApiClient = authApiClient;
        _tokenStore = tokenStore;
        _authService = authService;
    }

    private async void OnLoginClicked(object? sender, EventArgs e)
    {
        var email = EmailEntry.Text?.Trim() ?? string.Empty;
        var password = PasswordEntry.Text ?? string.Empty;

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            ShowError("E-posta ve şifre gereklidir.");
            return;
        }

        LoginButton.IsEnabled = false;
        ErrorLabel.IsVisible = false;

        try
        {
            var request = new LoginRequest(email, password);
            var response = await _authApiClient.LoginAsync(request);

            // Save tokens
            await _tokenStore.SaveTokensAsync(response.Token, response.RefreshToken);

            // Navigate to main app
            await Shell.Current.GoToAsync("//feed");
        }
        catch (ApiException apiEx)
        {
            var errorMessage = apiEx.StatusCode == System.Net.HttpStatusCode.Unauthorized
                ? "E-posta veya şifre hatalı."
                : "Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.";
            ShowError(errorMessage);
        }
        catch (Exception ex)
        {
            ShowError($"Bağlantı hatası: {ex.Message}");
        }
        finally
        {
            LoginButton.IsEnabled = true;
        }
    }

    private void OnRegisterTapped(object? sender, EventArgs e)
    {
        // TODO: Navigate to register page
        ShowError("Kayıt özelliği yakında eklenecek.");
    }

    private void ShowError(string message)
    {
        ErrorLabel.Text = message;
        ErrorLabel.IsVisible = true;
    }
}

