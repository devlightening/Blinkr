using Microsoft.Extensions.Logging;
using Blinkr.Mobile.Core.Auth;
using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Services;
using Blinkr.Mobile.Core.Http;
using Blinkr.Mobile.Features;
using Blinkr.Mobile.Features.Map;
using Microsoft.Extensions.Http.Resilience;

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

		// Register Services
		RegisterServices(builder.Services);

		// Register Pages and ViewModels
		RegisterPages(builder.Services);

#if DEBUG
		builder.Logging.AddDebug();
#endif

		return builder.Build();
	}

	private static void RegisterServices(IServiceCollection services)
	{
		// Environment Configuration
		services.AddSingleton<EnvironmentService>();
		services.AddSingleton(provider => provider.GetRequiredService<EnvironmentService>().Current);

		// Legacy Env support (for compatibility)
		services.AddSingleton<Env>(provider =>
		{
			var config = provider.GetRequiredService<EnvironmentConfig>();
			return new Env(
				ApiBase: config.ApiBaseUrl,
				Authority: config.IdentityBaseUrl,
				ClientId: "blinkr.mobile",
				RedirectUri: "blinkr://auth-callback",
				Scopes: "openid profile api.read api.write"
			);
		});

		// Auth Service
		services.AddSingleton<IAuthService, AuthService>();

		// HTTP Client with Device Headers and Resilience
		services.AddHttpClient("BlinkrApi", (provider, client) =>
		{
			var config = provider.GetRequiredService<EnvironmentConfig>();
			client.BaseAddress = new Uri(config.ApiBaseUrl);
			client.Timeout = TimeSpan.FromSeconds(15); // Overall timeout
			
			// Add device headers
			client.DefaultRequestHeaders.Add("X-Device-Id", GetDeviceId());
			client.DefaultRequestHeaders.Add("X-App-Version", GetAppVersion());
			client.DefaultRequestHeaders.Add("X-Platform", DeviceInfo.Platform.ToString());
		})
		.AddStandardResilienceHandler();

		// Auth refresh handler
		services.AddTransient<AuthRefreshHandler>();

		// API Client with Auth Refresh Handler
		services.AddHttpClient<IBlinkrApiClient, BlinkrApiClient>("BlinkrApi")
			.AddHttpMessageHandler<AuthRefreshHandler>();
	}

	private static string GetDeviceId()
	{
		var deviceId = Preferences.Get("DeviceId", string.Empty);
		if (string.IsNullOrEmpty(deviceId))
		{
			deviceId = Guid.NewGuid().ToString();
			Preferences.Set("DeviceId", deviceId);
		}
		return deviceId;
	}

	private static string GetAppVersion()
	{
		return AppInfo.VersionString;
	}

	private static void RegisterPages(IServiceCollection services)
	{
		// ViewModels
		services.AddTransient<MapViewModel>();

		// Pages
		services.AddTransient<MapPage>();
		services.AddTransient<FeedPage>();
		services.AddTransient<CreatePage>();
		services.AddTransient<NotificationsPage>();
		services.AddTransient<ProfilePage>();
	}
}
