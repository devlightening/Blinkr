using Microsoft.Extensions.Logging;
using Blinkr.Mobile.Core.Auth;
using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Services;
using Blinkr.Mobile.Features;
using Blinkr.Mobile.Features.Map;

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
		var env = Env.LoadFromConfig();
		services.AddSingleton(env);

		// Auth Service
		services.AddSingleton<IAuthService, AuthService>();

		// API Client
		services.AddSingleton<IApiClient>(provider =>
		{
			var environment = provider.GetRequiredService<Env>();
			var authService = provider.GetRequiredService<IAuthService>();
			var (apiClient, _) = ApiClientFactory.Create(environment, authService);
			return apiClient;
		});
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
