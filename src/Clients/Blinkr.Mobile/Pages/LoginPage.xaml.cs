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
            System.Diagnostics.Debug.WriteLine($"[LoginPage] Attempting login with email: {email}");
            System.Diagnostics.Debug.WriteLine($"[LoginPage] Request: {System.Text.Json.JsonSerializer.Serialize(request)}");
            System.Diagnostics.Debug.WriteLine($"[LoginPage] IAuthApiClient type: {_authApiClient.GetType()}");
            var response = await _authApiClient.LoginAsync(request);
            System.Diagnostics.Debug.WriteLine($"[LoginPage] Login successful: {response.UserName}");

            // Save tokens
            await _tokenStore.SaveTokensAsync(response.Token, response.RefreshToken);

            // Register device token for push notifications
            await _authService.RegisterDeviceTokenAsync();

            // Navigate to main app - set MainPage to AppShell
            var sp = Application.Current?.Handler?.MauiContext?.Services;
            if (sp != null && Application.Current != null)
            {
                var shell = sp.GetRequiredService<AppShell>();
#pragma warning disable CS0618
                Application.Current.MainPage = shell;
#pragma warning restore CS0618
            }
            else
            {
                // Fallback: navigate if MainPage is already Shell
                await Shell.Current.GoToAsync("//feed");
            }
        }
        catch (ApiException apiEx)
        {
            var errorMessage = apiEx.StatusCode == System.Net.HttpStatusCode.Unauthorized
                ? "E-posta veya şifre hatalı."
                : $"API Hatası ({apiEx.StatusCode}): {apiEx.Message}";
            ShowError(errorMessage);
            System.Diagnostics.Debug.WriteLine($"[LoginPage] ApiException: {apiEx}");
        }
        catch (HttpRequestException httpEx)
        {
            ShowError($"Ağ Hatası: {httpEx.Message}");
            System.Diagnostics.Debug.WriteLine($"[LoginPage] HttpRequestException: {httpEx}");
        }
        catch (Exception ex)
        {
            ShowError($"Hata: {ex.GetType().Name} - {ex.Message}");
            System.Diagnostics.Debug.WriteLine($"[LoginPage] Exception: {ex}");
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

