using Microsoft.Maui.Controls;
using Microsoft.Maui.Devices.Sensors;
using System.Net.Http;

namespace Blinkr.Mobile;

public partial class HomePage : ContentPage
{
    private readonly HttpClient _http;

    public HomePage(HttpClient http)
    {
        InitializeComponent();
        _http = http;
    }

    private async void OnPingClicked(object sender, EventArgs e)
    {
        try
        {
            var res = await _http.GetAsync("/health/ready");
            ResultLabel.Text = $"Ping: {(int)res.StatusCode}";
        }
        catch (Exception ex)
        {
            ResultLabel.Text = "Ping error: " + ex.Message;
        }
    }

    private async void OnLocationClicked(object sender, EventArgs e)
    {
        var status = await Permissions.RequestAsync<Permissions.LocationWhenInUse>();
        if (status != PermissionStatus.Granted)
        {
            ResultLabel.Text = "Location denied";
            return;
        }

        var loc = await Geolocation.Default.GetLastKnownLocationAsync()
                  ?? await Geolocation.Default.GetLocationAsync();
        ResultLabel.Text = loc != null
            ? $"Lat:{loc.Latitude:F5}, Lon:{loc.Longitude:F5}"
            : "No location";
    }
}
