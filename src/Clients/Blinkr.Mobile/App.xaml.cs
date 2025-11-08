using Microsoft.Maui.Controls;
using Microsoft.Extensions.DependencyInjection;
using Blinkr.Mobile.Core.Auth;

namespace Blinkr.Mobile;

public partial class App : Application
{
	private readonly IServiceProvider _sp;

	// LoginPage'den erişim için public property
	public IServiceProvider Services => _sp;

	public App(IServiceProvider sp)
	{
		InitializeComponent();
		_sp = sp;

		// 1) Önce hafif bir splash göster
#pragma warning disable CS0618
		MainPage = new ContentPage
		{
			BackgroundColor = (Color)Resources["Surface"],
			Content = new VerticalStackLayout
			{
				VerticalOptions = LayoutOptions.Center,
				HorizontalOptions = LayoutOptions.Center,
				Spacing = 16,
				Children =
				{
					new Label
					{
						Text = "Blinkr",
						FontSize = 48,
						FontAttributes = FontAttributes.Bold,
						TextColor = (Color)Resources["AccentYellow"],
						HorizontalOptions = LayoutOptions.Center
					},
					new ActivityIndicator
					{
						IsRunning = true,
						Color = (Color)Resources["AccentYellow"],
						HorizontalOptions = LayoutOptions.Center
					}
				}
			}
		};
#pragma warning restore CS0618

		// 2) Auth gate'i asenkron başlat (UI thread'i bloklamadan)
		Dispatcher.Dispatch(async () => await BootstrapAsync());
	}

	private async Task BootstrapAsync()
	{
		try
		{
			System.Diagnostics.Debug.WriteLine("[Blinkr] Bootstrap: Auth gate başladı");

			var authService = _sp.GetRequiredService<IAuthService>();
			var isAuthenticated = await authService.IsAuthenticatedAsync();

			System.Diagnostics.Debug.WriteLine($"[Blinkr] Bootstrap: isAuthenticated={isAuthenticated}");

			if (isAuthenticated)
			{
				// Token var → Shell'e geç
				var shell = _sp.GetRequiredService<AppShell>();
#pragma warning disable CS0618
				MainPage = shell;
#pragma warning restore CS0618
				System.Diagnostics.Debug.WriteLine("[Blinkr] Bootstrap: Shell yüklendi");
			}
			else
			{
				// Token yok → Login'e geç
				var loginPage = _sp.GetRequiredService<Pages.LoginPage>();
#pragma warning disable CS0618
				MainPage = new NavigationPage(loginPage)
				{
					BarBackgroundColor = (Color)Resources["Surface"],
					BarTextColor = (Color)Resources["TextPrimary"]
				};
#pragma warning restore CS0618
				System.Diagnostics.Debug.WriteLine("[Blinkr] Bootstrap: LoginPage yüklendi");
			}
		}
		catch (Exception ex)
		{
			System.Diagnostics.Debug.WriteLine($"[Blinkr] Bootstrap HATA: {ex.Message}");
			// Hata durumunda Login'e düş
			var loginPage = _sp.GetRequiredService<Pages.LoginPage>();
#pragma warning disable CS0618
			MainPage = new NavigationPage(loginPage);
#pragma warning restore CS0618
		}
	}
}