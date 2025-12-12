using Microsoft.Maui.Controls;
using Microsoft.Extensions.DependencyInjection;
using Blinkr.Mobile.Core.Auth;

namespace Blinkr.Mobile;

public partial class App : Application
{
	private readonly IServiceProvider _sp;

	public App(IServiceProvider sp)
	{
		InitializeComponent();
		_sp = sp;

		// 1) İlk pencere için geçici bir loading sayfası ver
		MainPage = new ContentPage
		{
			Content = new Grid
			{
				Children =
				{
					new ActivityIndicator
					{
						IsRunning = true,
						HorizontalOptions = LayoutOptions.Center,
						VerticalOptions = LayoutOptions.Center
					}
				}
			}
		};

		// 2) Auth durumunu async kontrol et ve gerçek MainPage'i ayarla
		_ = InitializeAuthAsync();
	}
	private async Task InitializeAuthAsync()
	{
		try
		{
			var authService = _sp.GetRequiredService<IAuthService>();
			
			// Add timeout to prevent hanging
			var authTask = authService.IsAuthenticatedAsync();
			var timeoutTask = Task.Delay(5000); // 5 second timeout
			var completedTask = await Task.WhenAny(authTask, timeoutTask);
			
			var isAuthenticated = false;
			if (completedTask == authTask)
			{
				isAuthenticated = await authTask;
			}
			else
			{
				System.Diagnostics.Debug.WriteLine("[App] Auth check timed out, defaulting to LoginPage");
				isAuthenticated = false;
			}

			await MainThread.InvokeOnMainThreadAsync(() =>
			{
				if (isAuthenticated)
				{
					// User is logged in, show Shell
#pragma warning disable CS0618
					MainPage = _sp.GetRequiredService<AppShell>();
#pragma warning restore CS0618
				}
				else
				{
					// User is not logged in, show LoginPage
#pragma warning disable CS0618
					MainPage = _sp.GetRequiredService<Pages.LoginPage>();
#pragma warning restore CS0618
				}
			});
		}
		catch (Exception ex)
		{
			System.Diagnostics.Debug.WriteLine($"[App] Auth initialization failed: {ex.Message}");
			// Fallback to LoginPage on error
			await MainThread.InvokeOnMainThreadAsync(() =>
			{
#pragma warning disable CS0618
				MainPage = _sp.GetRequiredService<Pages.LoginPage>();
#pragma warning restore CS0618
			});
		}
	}

	// CreateWindow override'ını KALDIR (gerek yok)
}