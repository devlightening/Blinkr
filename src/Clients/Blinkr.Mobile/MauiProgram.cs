using Microsoft.Extensions.Logging;
using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Auth;
using Blinkr.Mobile.Core.Services;
using Blinkr.Mobile.Features;
using Blinkr.Mobile.Features.Auth;
using Blinkr.Mobile.Features.Map;
using Blinkr.Mobile.Features.Services;
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
        // Service Base URLs - Android emulator uses 10.0.2.2 to access host machine
        var blogServiceUrl = DeviceInfo.Platform == DevicePlatform.Android
            ? "http://10.0.2.2:5215" // BlogService port
            : "http://localhost:5215";
            
        var notificationsServiceUrl = DeviceInfo.Platform == DevicePlatform.Android
            ? "http://10.0.2.2:5212" // NotificationsService port
            : "http://localhost:5212";
            
        var identityServiceUrl = DeviceInfo.Platform == DevicePlatform.Android
            ? "http://10.0.2.2:5188" // IdentityService HTTP port
            : "http://localhost:5188";

        // Create HttpClient handler factory
        System.Func<HttpMessageHandler> createHandler = () =>
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
        };

        // Register TokenStore
        services.AddSingleton<ITokenStore, TokenStore>();
        
        // Register notification services
        services.AddSingleton<INotificationDeviceTokenProvider, StubNotificationDeviceTokenProvider>();
        services.AddSingleton<INotificationsBadgeService, NotificationsBadgeService>();
        
        // Register geolocation service
        services.AddSingleton<IGeolocation>(Geolocation.Default);

        // Register AuthService (depends on ITokenStore + optional notification services)
        services.AddSingleton<IAuthService>(sp =>
        {
            var tokenStore = sp.GetRequiredService<ITokenStore>();
            var notificationsApi = sp.GetService<INotificationsApiClient>();
            var tokenProvider = sp.GetService<INotificationDeviceTokenProvider>();
            return new AuthService(tokenStore, notificationsApi, tokenProvider);
        });

        // Register AuthMessageHandler (for HttpClient token injection)
        services.AddTransient<AuthMessageHandler>();
        
        // Register AuthRefreshHandler (with automatic 401 refresh)
        services.AddTransient<AuthRefreshHandler>();
        
        // Auth API Client (for login/refresh) - No auth handler needed (login endpoint)
        services.AddRefitClient<IAuthApiClient>()
            .ConfigureHttpClient(c =>
            {
                c.BaseAddress = new Uri(identityServiceUrl);
                c.Timeout = TimeSpan.FromSeconds(30);
                c.DefaultRequestHeaders.Add("User-Agent", "Blinkr-Mobile/1.0");
            })
            .ConfigurePrimaryHttpMessageHandler(createHandler);

        // Blinkr API Client (for map/posts) - WITH auth refresh handler (auto-refresh on 401)
        services.AddRefitClient<IBlinkrApiClient>()
            .ConfigureHttpClient(c =>
            {
                c.BaseAddress = new Uri(blogServiceUrl);
                c.Timeout = TimeSpan.FromSeconds(30);
                c.DefaultRequestHeaders.Add("User-Agent", "Blinkr-Mobile/1.0");
            })
            .AddHttpMessageHandler<AuthRefreshHandler>()
            .ConfigurePrimaryHttpMessageHandler(createHandler);

        // Notifications API Client - WITH auth refresh handler
        services.AddRefitClient<INotificationsApiClient>()
            .ConfigureHttpClient(c =>
            {
                c.BaseAddress = new Uri(notificationsServiceUrl);
                c.Timeout = TimeSpan.FromSeconds(30);
                c.DefaultRequestHeaders.Add("User-Agent", "Blinkr-Mobile/1.0");
            })
            .AddHttpMessageHandler<AuthRefreshHandler>()
            .ConfigurePrimaryHttpMessageHandler(createHandler);

        // Legacy API Client (if still used) - WITH auth refresh handler
        services.AddRefitClient<IApiClient>()
            .ConfigureHttpClient(c =>
            {
                c.BaseAddress = new Uri(blogServiceUrl);
                c.Timeout = TimeSpan.FromSeconds(30);
                c.DefaultRequestHeaders.Add("User-Agent", "Blinkr-Mobile/1.0");
            })
            .AddHttpMessageHandler<AuthRefreshHandler>()
            .ConfigurePrimaryHttpMessageHandler(createHandler);

        // Geolocation service
        services.AddSingleton<IGeolocation>(Geolocation.Default);
    }

    private static void ConfigurePages(IServiceCollection services)
    {
        // Register Services
        services.AddTransient<IFeedFilterService, FeedFilterService>();
        services.AddTransient<IPostMapper, PostMapper>();

        // Register ViewModels
        services.AddTransient<FeedViewModel>();
        services.AddTransient<MapViewModel>();
        services.AddTransient<SettingsViewModel>();
        services.AddTransient<NotificationsViewModel>();
        services.AddTransient<ProfileViewModel>();

        // Register all pages as transient
        services.AddTransient<FeedPage>();
        services.AddTransient<MapPage>();
        services.AddTransient<CreatePage>(sp =>
        {
            var apiClient = sp.GetService<IApiClient>();
            var geolocation = sp.GetRequiredService<IGeolocation>();
            return new CreatePage(apiClient, geolocation);
        });
        services.AddTransient<NotificationsPage>();
        services.AddTransient<ProfilePage>();
        services.AddTransient<SettingsPage>();
        
        // Register Auth pages
        services.AddTransient<LoginPage>();
    }
}
