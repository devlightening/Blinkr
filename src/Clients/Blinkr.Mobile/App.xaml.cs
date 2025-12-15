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

		_ = InitializeAuthAsync();
	}

	private async Task InitializeAuthAsync()
	{
		try
		{
			var authService = _sp.GetRequiredService<IAuthService>();
			
			var authTask = authService.IsAuthenticatedAsync();
			var timeoutTask = Task.Delay(5000);
			var completedTask = await Task.WhenAny(authTask, timeoutTask);
			
			var isAuthenticated = false;
			if (completedTask == authTask)
			{
				isAuthenticated = await authTask;
			}

			await MainThread.InvokeOnMainThreadAsync(() =>
			{
				MainPage = _sp.GetRequiredService<AppShell>();
			});
		}
		catch (Exception ex)
		{
			System.Diagnostics.Debug.WriteLine($"[App] Auth initialization failed: {ex.Message}");
			await MainThread.InvokeOnMainThreadAsync(() =>
			{
				MainPage = _sp.GetRequiredService<AppShell>();
			});
		}
	}
}
