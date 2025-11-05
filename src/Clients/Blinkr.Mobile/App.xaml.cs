using Microsoft.Maui.Controls;
using Microsoft.Extensions.DependencyInjection;

namespace Blinkr.Mobile;

public partial class App : Application
{
	private readonly IServiceProvider _sp;

	// >>> AppShell DEĞİL, IServiceProvider al
	public App(IServiceProvider sp)
	{
		InitializeComponent();          // 1) Uygulama kaynakları burada yüklenir
		_sp = sp;

		// 2) ResourceDictionary yüklendikten sonra Shell'i resolve et
		var shell = _sp.GetRequiredService<AppShell>();
#pragma warning disable CS0618 // MainPage is deprecated, but required for App initialization before Window is created
		MainPage = shell;               // 3) Artık güvenli
#pragma warning restore CS0618
	}

	// CreateWindow override'ını KALDIR (gerek yok)
}