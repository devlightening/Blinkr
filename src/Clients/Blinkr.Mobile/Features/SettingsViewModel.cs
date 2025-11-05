using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using Microsoft.Maui;
using Microsoft.Maui.Controls;

namespace Blinkr.Mobile.Features;

public sealed partial class SettingsViewModel : ObservableObject
{
    // Tema anahtarı
    [ObservableProperty] private bool isDark = true;

    // Şifre alanları (örnek)
    [ObservableProperty] private string oldPassword = string.Empty;
    [ObservableProperty] private string newPassword = string.Empty;

    public SettingsViewModel()
    {
        // Initialize theme from current app theme
        IsDark = Application.Current?.RequestedTheme == AppTheme.Dark;
    }

    // --- Helpers ---

    // MAUI 9: MainPage yerine Windows[0].Page veya Shell.Current kullan
    private static Page? GetPage()
        => Application.Current?.Windows?.FirstOrDefault()?.Page ?? Shell.Current;

    private static Task ShowAlertAsync(string title, string message)
        => MainThread.InvokeOnMainThreadAsync(async () =>
        {
            var page = GetPage();
            if (page is null) return;
            await page.DisplayAlert(title, message, "Tamam");
        });

    // --- Theme toggle ---

    partial void OnIsDarkChanged(bool value)
    {
        // UI thread'te App tema değişimi
        MainThread.BeginInvokeOnMainThread(() =>
        {
            if (Application.Current is null) return;
            Application.Current.UserAppTheme = value ? AppTheme.Dark : AppTheme.Light;
        });

        // (Opsiyonel) Harita teması da güncellensin diye mesaj yayınla
        WeakReferenceMessenger.Default.Send(new ThemeChangedMessage(value ? "dark" : "light"));
    }

    // --- Commands ---

    [RelayCommand]
    public async Task ChangePasswordAsync()
    {
        if (string.IsNullOrWhiteSpace(NewPassword))
        {
            await ShowAlertAsync("Uyarı", "Yeni şifre boş olamaz.");
            return;
        }

        if (NewPassword.Length < 6)
        {
            await ShowAlertAsync("Uyarı", "Yeni şifre en az 6 karakter olmalıdır.");
            return;
        }

        try
        {
            // TODO: Burada gerçek API çağrını yap (await _authApi.ChangePassword(...);)
            await Task.Delay(300); // demo

            await ShowAlertAsync("Başarılı", "Şifre güncellendi. (API entegrasyonu yakında eklenecek)");
            OldPassword = string.Empty;
            NewPassword = string.Empty;
        }
        catch (Exception ex)
        {
            await ShowAlertAsync("Hata", $"Şifre güncellenemedi.\n{ex.Message}");
        }
    }
}

// Tema değişimini map'e duyurmak için basit mesaj tipi
public sealed record ThemeChangedMessage(string Value);
