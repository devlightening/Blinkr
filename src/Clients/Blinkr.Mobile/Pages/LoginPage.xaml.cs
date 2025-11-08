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

        System.Diagnostics.Debug.WriteLine($"[Blinkr] Login başlatıldı: {email}");

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            System.Diagnostics.Debug.WriteLine("[Blinkr] Login: Validasyon hatası");
            ShowError("E-posta ve şifre gereklidir.");
            return;
        }

        LoginButton.IsEnabled = false;
        ErrorLabel.IsVisible = false;

        try
        {
            System.Diagnostics.Debug.WriteLine("[Blinkr] Login: API isteği gönderiliyor...");
            var request = new LoginRequest(email, password);
            var response = await _authApiClient.LoginAsync(request);

            System.Diagnostics.Debug.WriteLine($"[Blinkr] Login: Token alındı, uzunluk={response.Token?.Length}");

            // Save tokens
            await _tokenStore.SaveTokensAsync(response.Token, response.RefreshToken);

            System.Diagnostics.Debug.WriteLine("[Blinkr] Login başarılı, Shell'e geçiliyor");

            // Navigate to main app - MainPage swap ile
            var shell = ((App)Application.Current).Services.GetRequiredService<AppShell>();
#pragma warning disable CS0618
            Application.Current.MainPage = shell;
#pragma warning restore CS0618
        }
        catch (ApiException apiEx)
        {
            var errorBody = "";
            try { errorBody = await apiEx.GetContentAsAsync<string>() ?? "(boş)"; } catch { }
            System.Diagnostics.Debug.WriteLine($"[Blinkr] Login HATA: {apiEx.StatusCode} - {errorBody}");
            
            var errorMessage = apiEx.StatusCode == System.Net.HttpStatusCode.Unauthorized
                ? "E-posta veya şifre hatalı."
                : $"Giriş hatası: {(int)apiEx.StatusCode}";
            ShowError(errorMessage);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Blinkr] Login EXCEPTION: {ex.GetType().Name} - {ex.Message}");
            System.Diagnostics.Debug.WriteLine($"[Blinkr] StackTrace: {ex.StackTrace}");
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

