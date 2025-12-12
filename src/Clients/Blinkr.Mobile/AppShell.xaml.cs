using Blinkr.Mobile.Features;
using Blinkr.Mobile.Pages;

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
		Routing.RegisterRoute("login", typeof(Pages.LoginPage));
		Routing.RegisterRoute(nameof(Features.FeedPage), typeof(Features.FeedPage));
		Routing.RegisterRoute(nameof(Features.MapPage), typeof(Features.MapPage));         
		Routing.RegisterRoute(nameof(CreatePage), typeof(CreatePage));
		Routing.RegisterRoute(nameof(Features.NotificationsPage), typeof(Features.NotificationsPage));
		Routing.RegisterRoute(nameof(Features.ProfilePage), typeof(Features.ProfilePage));  
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
					Content = _serviceProvider.GetRequiredService<Features.FeedPage>(),
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
					Content = _serviceProvider.GetRequiredService<Features.MapPage>(),
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
					Content = _serviceProvider.GetRequiredService<Features.NotificationsPage>(),
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
					Content = _serviceProvider.GetRequiredService<Features.ProfilePage>(),   // Features.ProfilePage
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
