using Blinkr.Mobile.Features;
using Blinkr.Mobile.Features.Auth;
using Blinkr.Mobile.Core.Auth;

namespace Blinkr.Mobile;

public partial class AppShell : Shell
{
	private readonly IServiceProvider? _serviceProvider;

	public AppShell()
	{
		InitializeComponent();
	}

	public AppShell(IServiceProvider serviceProvider) : this()
	{
		_serviceProvider = serviceProvider;
		RegisterRoutes();
		CheckAuthenticationAndBuild();
	}

	private void RegisterRoutes()
	{
		Routing.RegisterRoute(nameof(FeedPage), typeof(FeedPage));
		Routing.RegisterRoute(nameof(MapPage), typeof(MapPage));         
		Routing.RegisterRoute(nameof(CreatePage), typeof(CreatePage));
		Routing.RegisterRoute(nameof(NotificationsPage), typeof(NotificationsPage));
		Routing.RegisterRoute(nameof(ProfilePage), typeof(ProfilePage));  
		Routing.RegisterRoute(nameof(SettingsPage), typeof(SettingsPage));
		Routing.RegisterRoute(nameof(LoginPage), typeof(LoginPage));
	}

	private async void CheckAuthenticationAndBuild()
	{
		if (_serviceProvider == null)
		{
			return;
		}

		// Check if user is authenticated
		var authService = _serviceProvider.GetRequiredService<IAuthService>();
		var isAuthenticated = await authService.IsAuthenticatedAsync();

		if (isAuthenticated)
		{
			// User is logged in - show main app tabs
			BuildTabs();
		}
		else
		{
			// User is not logged in - show login page
			ShowLoginPage();
		}
	}

	private void ShowLoginPage()
	{
		Items.Clear();
		
		if (_serviceProvider == null)
		{
			return;
		}

		var loginPage = _serviceProvider.GetRequiredService<LoginPage>();
		var loginContent = new ShellContent
		{
			Content = loginPage,
			Route = "login"
		};

		Items.Add(loginContent);
	}

	private void BuildTabs()
	{
		if (_serviceProvider == null)
		{
			return;
		}

		Items.Clear();

		var feedTab = new Tab
		{
			Title = "Akış",
			Icon = "feed.png",
			Route = "feed",
			Items =
			{
				new ShellContent
				{
					Content = _serviceProvider.GetRequiredService<FeedPage>(),
					Route = "feed"
				}
			}
		};

		var mapTab = new Tab
		{
			Title = "Harita",
			Icon = "map.png",
			Route = "map",
			Items =
			{
				new ShellContent
				{
					Content = _serviceProvider.GetRequiredService<MapPage>(),
					Route = "map"
				}
			}
		};

		var createTab = new Tab
		{
			Title = "Oluştur",
			Icon = "create.png",
			Route = "create",
			Items =
			{
				new ShellContent
				{
					Content = new CreatePage(),
					Route = "create"
				}
			}
		};

		var notificationsTab = new Tab
		{
			Title = "Bildirimler",
			Icon = "notifications.png",
			Route = "notifications",
			Items =
			{
				new ShellContent
				{
					Content = _serviceProvider.GetRequiredService<NotificationsPage>(),
					Route = "notifications"
				}
			}
		};

		var profileTab = new Tab
		{
			Title = "Profil",
			Icon = "profile.png",
			Route = "profile",
			Items =
			{
				new ShellContent
				{
					Content = _serviceProvider.GetRequiredService<ProfilePage>(),
					Route = "profile"
				}
			}
		};

		var tabBar = new TabBar();
		tabBar.Items.Add(feedTab);
		tabBar.Items.Add(mapTab);
		tabBar.Items.Add(createTab);
		tabBar.Items.Add(notificationsTab);
		tabBar.Items.Add(profileTab);

		Items.Add(tabBar);
	}

	public void RebuildUI()
	{
		CheckAuthenticationAndBuild();
	}
}
