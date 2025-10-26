using Microsoft.Maui.Controls.Maps;
using Microsoft.Maui.Maps;
using Blinkr.Mobile.Features.Map;

namespace Blinkr.Mobile.Features;

public partial class MapPage : ContentPage
{
    public MapPage(MapViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
        InitializeMap();
    }

    private void InitializeMap()
    {
        // Set initial location to Istanbul
        var istanbul = new Location(41.0082, 28.9784);
        var mapSpan = MapSpan.FromCenterAndRadius(istanbul, Distance.FromKilometers(5));
        MainMap.MoveToRegion(mapSpan);

        // Add sample pins (will be replaced with real data)
        AddSamplePins();
    }

    private void AddSamplePins()
    {
        // Sample pins for demonstration
        var pins = new[]
        {
            new Pin
            {
                Label = "Galata Kulesi",
                Address = "Beyoğlu, İstanbul",
                Type = PinType.Place,
                Location = new Location(41.0256, 28.9744)
            },
            new Pin
            {
                Label = "Sultanahmet",
                Address = "Fatih, İstanbul", 
                Type = PinType.Place,
                Location = new Location(41.0058, 28.9784)
            },
            new Pin
            {
                Label = "Taksim Meydanı",
                Address = "Beyoğlu, İstanbul",
                Type = PinType.Place,
                Location = new Location(41.0369, 28.9850)
            }
        };

        foreach (var pin in pins)
        {
            MainMap.Pins.Add(pin);
        }
    }

    private async void OnCreatePostClicked(object sender, EventArgs e)
    {
        // Navigate to create post page
        await Shell.Current.GoToAsync("//create");
    }

    // Handle pin selection to show bottom sheet
    private async void OnPinClicked(object sender, EventArgs e)
    {
        // TODO: Get actual post data from pin
        // For now, show sample data
        var samplePost = new Blinkr.Mobile.Core.Api.PostListDto(
            Id: Guid.NewGuid(),
            Title: "Galata Kulesi Manzarası",
            Content: "İstanbul'un en güzel manzaralarından biri. Günbatımında muhteşem görünüyor.",
            AuthorName: "Gezgin Kullanıcı",
            CreatedAt: DateTime.Now.AddHours(-2),
            LikeCount: 15,
            DistanceMeters: 350,
            LocationName: "Galata Kulesi"
        );
        
        BottomSheet.Post = samplePost;
        await BottomSheet.ShowAsync();
    }

    // Handle map tap to hide bottom sheet
    private async void OnMapTapped(object sender, EventArgs e)
    {
        if (BottomSheet.IsVisible)
        {
            await BottomSheet.HideAsync();
        }
    }
}
