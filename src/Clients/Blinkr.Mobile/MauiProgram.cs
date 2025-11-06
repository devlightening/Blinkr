using Microsoft.Extensions.Logging;
using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Auth;
using Blinkr.Mobile.Features;
using Blinkr.Mobile.Features.Map;
using Refit;
using System.Net.Http;

namespace Blinkr.Mobile;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        
        // 1) App'i factory ile kaydet (sp => new App(sp))
        builder
            .UseMauiApp(sp => new App(sp))
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

#if DEBUG
        builder.Logging.AddDebug();
#endif

        // API Configuration
        ConfigureApiServices(builder.Services);
        
        // Register Pages (must be before AppShell)
        ConfigurePages(builder.Services);

        // 2) AppShell'i FACTORYSİZ kaydet (erken kurulum tetiklenmesin)
        builder.Services.AddSingleton<AppShell>();
        
        return builder.Build();
    }

    private static void ConfigureApiServices(IServiceCollection services)
    {
        // Base URL - Android emulator uses 10.0.2.2 to access host machine
        // BlogService API runs on port 5215 (see launchSettings.json)
        var baseUrl = DeviceInfo.Platform == DevicePlatform.Android
            ? "http://10.0.2.2:5215" // Android emulator -> host machine
            : "http://localhost:5215"; // Windows/iOS

        // Configure Refit HTTP Client with proper error handling
        services.AddRefitClient<IApiClient>()
            .ConfigureHttpClient(c =>
            {
                c.BaseAddress = new Uri(baseUrl);
                c.Timeout = TimeSpan.FromSeconds(30);
                c.DefaultRequestHeaders.Add("User-Agent", "Blinkr-Mobile/1.0");
            })
            .ConfigurePrimaryHttpMessageHandler(() =>
            {
#if ANDROID
                // Android requires AndroidMessageHandler for cleartext HTTP
                return new Xamarin.Android.Net.AndroidMessageHandler
                {
                    ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true
                };
#elif DEBUG
                // Development only - bypass SSL validation
                return new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
                };
#else
                return new HttpClientHandler();
#endif
            });

        // Blinkr API Client (for map/posts)
        services.AddRefitClient<IBlinkrApiClient>()
            .ConfigureHttpClient(c =>
            {
                c.BaseAddress = new Uri(baseUrl);
                c.Timeout = TimeSpan.FromSeconds(30);
                c.DefaultRequestHeaders.Add("User-Agent", "Blinkr-Mobile/1.0");
            })
            .ConfigurePrimaryHttpMessageHandler(() =>
            {
#if ANDROID
                // Android requires AndroidMessageHandler for cleartext HTTP
                return new Xamarin.Android.Net.AndroidMessageHandler
                {
                    ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true
                };
#elif DEBUG
                return new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
                };
#else
                return new HttpClientHandler();
#endif
            });

        // Environment Configuration
        var env = Env.LoadFromConfig();
        services.AddSingleton(env);

        // Auth Service
        services.AddSingleton<IAuthService, AuthService>();

        // Geolocation service
        services.AddSingleton<IGeolocation>(Geolocation.Default);
    }

    private static void ConfigurePages(IServiceCollection services)
    {
        // Register ViewModels
        services.AddTransient<MapViewModel>();
        services.AddTransient<SettingsViewModel>();

        // Register all pages as transient
        services.AddTransient<FeedPage>();
        services.AddTransient<MapPage>();
        services.AddTransient<CreatePage>();
        services.AddTransient<NotificationsPage>();
        services.AddTransient<ProfilePage>();
        services.AddTransient<SettingsPage>();
    }
}
