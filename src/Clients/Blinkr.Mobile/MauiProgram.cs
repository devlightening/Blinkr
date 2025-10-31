using Microsoft.Extensions.Logging;
using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Features;
using Refit;
using System.Net.Http;

namespace Blinkr.Mobile;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        
        builder
            .UseMauiApp<App>()
            .UseMauiMaps()
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
        
        // Register Pages
        ConfigurePages(builder.Services);

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
#if DEBUG
                // Development only - bypass SSL validation
                return new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
                };
#else
                return new HttpClientHandler();
#endif
            });

        // Geolocation service
        services.AddSingleton<IGeolocation>(Geolocation.Default);
    }

    private static void ConfigurePages(IServiceCollection services)
    {
        // Register all pages as transient
        services.AddTransient<FeedPage>();
        services.AddTransient<MapPage>();
        services.AddTransient<CreatePage>();
        services.AddTransient<NotificationsPage>();
        services.AddTransient<ProfilePage>();
    }
}
