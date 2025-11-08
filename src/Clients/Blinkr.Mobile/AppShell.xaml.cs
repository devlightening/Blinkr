using Blinkr.Mobile.Features;

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
		BuildTabs();
	}

	private void RegisterRoutes()
	{
		// Register routes for navigation
		Routing.RegisterRoute("login", typeof(Pages.LoginPage));
		Routing.RegisterRoute(nameof(FeedPage), typeof(FeedPage));
		Routing.RegisterRoute(nameof(MapPage), typeof(MapPage));
		Routing.RegisterRoute(nameof(CreatePage), typeof(CreatePage));
		Routing.RegisterRoute(nameof(NotificationsPage), typeof(NotificationsPage));
		Routing.RegisterRoute(nameof(ProfilePage), typeof(ProfilePage));
		Routing.RegisterRoute(nameof(SettingsPage), typeof(SettingsPage));
	}

	private void BuildTabs()
	{
		if (_serviceProvider == null)
		{
			// Fallback: Use XAML-defined tabs if DI is not available
			return;
		}

		// Clear existing items from XAML
		Items.Clear();

		// Create tabs with DI-resolved pages
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
					Content = _serviceProvider.GetRequiredService<CreatePage>(),
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
}
