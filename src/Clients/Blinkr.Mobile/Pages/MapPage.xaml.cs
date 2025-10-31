using Microsoft.Maui.Controls.Maps;
using Microsoft.Maui.Maps;

namespace Blinkr.Mobile.Pages;

public partial class MapPage : ContentPage
{
    public MapPage()
    {
        InitializeComponent();
        BlinkrMap.MoveToRegion(MapSpan.FromCenterAndRadius(
            new Location(41.0082, 28.9784), Distance.FromKilometers(5))); // İstanbul
    }
}

