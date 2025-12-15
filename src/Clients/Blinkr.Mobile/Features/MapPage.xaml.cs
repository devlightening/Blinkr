using Blinkr.Mobile.Features.Map;
using System.Text.Json;
using CommunityToolkit.Mvvm.Messaging;

namespace Blinkr.Mobile.Features;

public partial class MapPage : ContentPage
{
    private readonly MapViewModel _viewModel;
    private bool _isMapReady = false;

    public MapPage(MapViewModel viewModel)
    {
        InitializeComponent();

        _viewModel = viewModel;
        BindingContext = _viewModel;

        _viewModel.PropertyChanged += OnViewModelPropertyChanged;
        
        // Handle app:// scheme from JavaScript
        MapWebView.Navigating += OnMapWebViewNavigating;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        System.Diagnostics.Debug.WriteLine("🚀 [C#] MapPage.OnAppearing called");

        await _viewModel.InitializeModernAsync();

        LoadLeafletMap();

        WeakReferenceMessenger.Default.Register<ThemeChangedMessage>(this, async (_, m) =>
        {
            var theme = m.Value == "dark" ? "dark" : "light";
            await UpdateMapThemeAsync(theme);
        });
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        WeakReferenceMessenger.Default.Unregister<ThemeChangedMessage>(this);
    }

    private void LoadLeafletMap()
    {
        System.Diagnostics.Debug.WriteLine("📄 [C#] LoadLeafletMap called");

        try
        {
            var url = GetLeafletMapUrl();
            System.Diagnostics.Debug.WriteLine($"🔗 [C#] Leaflet URL: {url}");

            if (!string.IsNullOrEmpty(url))
            {
                MapWebView.Source = new UrlWebViewSource { Url = url };
                System.Diagnostics.Debug.WriteLine($"✅ Loading Leaflet map from: {url}");
            }
            else
            {
                var htmlSource = new HtmlWebViewSource
                {
                    BaseUrl = "https://unpkg.com/",
                    Html = GetInlineLeafletHtml()
                };
                MapWebView.Source = htmlSource;
                System.Diagnostics.Debug.WriteLine("⚠️ Using inline HTML fallback");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"❌ Error loading Leaflet map: {ex}");
            var htmlSource = new HtmlWebViewSource
            {
                BaseUrl = "https://unpkg.com/",
                Html = GetInlineLeafletHtml()
            };
            MapWebView.Source = htmlSource;
        }
    }

    private string GetLeafletMapUrl()
    {
#if ANDROID
        System.Diagnostics.Debug.WriteLine("🔍 Android: Using asset path: file:///android_asset/wwwroot/leaflet-map.html");
        return "file:///android_asset/wwwroot/leaflet-map.html";
#elif WINDOWS
        return "ms-appx-web:///wwwroot/leaflet-map.html";
#elif IOS || MACCATALYST
        return "ms-appx-web:///wwwroot/leaflet-map.html";
#else
        return string.Empty;
#endif
    }

    private string GetInlineLeafletHtml()
    {
        // CartoDB Dark Matter Teması kullanılıyor (Resimdeki gibi siyah harita için)
        return @"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"">
    <link rel=""stylesheet"" href=""https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #map { height: 100%; width: 100%; background: #0F1115; }
        
        /* Harita kontrollerini (zoom butonları) özelleştirme */
        .leaflet-bar a { background-color: #1C1E26 !important; color: #FFD42A !important; border-bottom: 1px solid #333 !important; }
        
        /* Custom marker style */
        .custom-marker { width: 32px; height: 40px; background: #4A90E2; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid #FFD42A; }
    </style>
</head>
<body>
    <div id=""map""></div>
    <script src=""https://unpkg.com/leaflet@1.9.4/dist/leaflet.js""></script>
    <script>
        let map;
        let markers = {};
        
        document.addEventListener('DOMContentLoaded', function() {
            map = L.map('map', { center: [41.0082, 28.9784], zoom: 13, zoomControl: false });
            
            // DARK MODE TILE LAYER (CARTO DB DARK MATTER)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CartoDB',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(map);
            
            // Map click event - close bottom sheet
            map.on('click', function() {
                window.location.href = 'app://mapclick';
            });
        });
        
        window.setMapCenter = function(lat,lng,z){ 
            if(map) {
                map.setView([lat,lng], z || 13);
                console.log('Map center set to: ' + lat + ', ' + lng);
            } else {
                console.error('Map not initialized yet');
            }
        };
        
        // Pin ekleme ve tıklaması event'i
        window.updateMarkersFromBase64 = function(jsonBase64) {
            try {
                const json = atob(jsonBase64);
                const markersData = JSON.parse(json);
                
                // Eski marker'ları temizle
                Object.values(markers).forEach(m => map.removeLayer(m));
                markers = {};
                
                // Yeni marker'ları ekle
                markersData.forEach(function(markerData) {
                    const marker = L.circleMarker([markerData.lat, markerData.lng], {
                        radius: 12,
                        fillColor: '#4A90E2',
                        color: '#FFD42A',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(map);
                    
                    // Store ID in marker for closure
                    marker.markerId = markerData.id;
                    
                    // Pin tıklaması event'i
                    marker.on('click', function(e) {
                        e.stopPropagation();
                        const id = this.markerId;
                        console.log('Pin clicked: ' + id);
                        // Navigate to pin detail
                        window.location.href = 'app://pin?id=' + id;
                    });
                    
                    markers[markerData.id] = marker;
                });
                
                console.log('Updated ' + markersData.length + ' markers');
            } catch(e) {
                console.error('Error updating markers: ' + e.message);
            }
        };
    </script>
</body>
</html>";
    }

    private void OnWebViewNavigating(object? sender, WebNavigatingEventArgs e)
    {
        if (e.Url?.StartsWith("app://") == true)
        {
            e.Cancel = true;
            HandleAppScheme(e.Url);
            return;
        }

        if (e.Url?.StartsWith("http") == true &&
            !e.Url.Contains("openstreetmap") &&
            !e.Url.Contains("unpkg.com") &&
            !e.Url.Contains("stadiamaps.com") &&
            !e.Url.Contains("cartodb.com") &&
            !e.Url.Contains("mapbox.com"))
        {
            e.Cancel = true;
        }

        if (e.Url?.StartsWith("file://") == true ||
            e.Url?.StartsWith("ms-appx-web://") == true)
        {
            return;
        }
    }

    private async void HandleAppScheme(string url)
    {
        try
        {
            System.Diagnostics.Debug.WriteLine($"[MapPage] HandleAppScheme: {url}");
            var uri = new Uri(url);

            if (uri.Host == "pin")
            {
                var query = ParseQueryString(uri.Query);
                var id = query.GetValueOrDefault("id");

                System.Diagnostics.Debug.WriteLine($"[MapPage] Pin clicked, id={id}");

                if (!string.IsNullOrEmpty(id) && Guid.TryParse(id, out var postId))
                {
                    await _viewModel.LoadPostDetailAsync(postId);
                    System.Diagnostics.Debug.WriteLine("[MapPage] LoadPostDetailAsync completed");
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"[MapPage] Invalid post ID: {id}");
                }
            }
            else if (uri.Host == "mapclick")
            {
                _viewModel.CloseBottomSheetCommand.Execute(null);
            }
            else if (uri.Host == "scan")
            {
                var query = ParseQueryString(uri.Query);
                var bbox = query.GetValueOrDefault("bbox");

                if (!string.IsNullOrEmpty(bbox))
                {
                    try
                    {
                        var parts = bbox.Split(',');
                        if (parts.Length == 4 &&
                            double.TryParse(parts[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var west) &&
                            double.TryParse(parts[1], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var south) &&
                            double.TryParse(parts[2], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var east) &&
                            double.TryParse(parts[3], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var north))
                        {
                            var bounds = new MapBounds
                            {
                                West = west,
                                South = south,
                                East = east,
                                North = north,
                                Center = new MapCenter
                                {
                                    Lat = (north + south) / 2.0,
                                    Lng = (east + west) / 2.0
                                }
                            };

                            await _viewModel.ScanAsync(bounds);
                            System.Diagnostics.Debug.WriteLine($"✅ Scan completed for bbox: {bbox}");
                        }
                        else
                        {
                            System.Diagnostics.Debug.WriteLine($"❌ Invalid bbox format: {bbox}");
                            await _viewModel.ScanAsync(null);
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"❌ Scan bbox parse error: {ex.Message}");
                        await _viewModel.ScanAsync(null);
                    }
                }
                else
                {
                    await _viewModel.ScanAsync(null);
                }
            }
            else if (uri.Host == "mylocation")
            {
                await GoToMyLocationAsync();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"❌ Error handling app scheme: {ex}");
        }
    }

    private async Task GoToMyLocationAsync()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("📍 Getting user location...");

            var location = await Task.Run(async () =>
            {
                try
                {
                    return await Geolocation.GetLocationAsync(new GeolocationRequest
                    {
                        DesiredAccuracy = GeolocationAccuracy.Medium,
                        Timeout = TimeSpan.FromSeconds(6)
                    });
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"❌ Geolocation error: {ex.Message}");
                    return null;
                }
            });

            if (location != null)
            {
                var lat = location.Latitude.ToString(System.Globalization.CultureInfo.InvariantCulture);
                var lng = location.Longitude.ToString(System.Globalization.CultureInfo.InvariantCulture);
                var script = $"map.setView([{lat},{lng}], 15, {{ animate: true }});";

                await EvalJSAsync(script);
                System.Diagnostics.Debug.WriteLine($"✅ Navigated to user location: {lat}, {lng}");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine("⚠️ Could not get user location");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"❌ GoToMyLocation error: {ex}");
        }
    }

    private static Dictionary<string, string> ParseQueryString(string query)
    {
        var result = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(query)) return result;

        if (query.StartsWith("?"))
            query = query.Substring(1);

        foreach (var pair in query.Split('&'))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length == 2)
            {
                var key = Uri.UnescapeDataString(parts[0]);
                var value = Uri.UnescapeDataString(parts[1]);
                result[key] = value;
            }
        }

        return result;
    }

    private async void OnWebViewNavigated(object? sender, WebNavigatedEventArgs e)
    {
        System.Diagnostics.Debug.WriteLine($"🚀 [C#] OnWebViewNavigated called! Result={e.Result}, Url={e.Url}");

        if (e.Result == WebNavigationResult.Success)
        {
            await Task.Delay(1000);
            // Mark map as ready immediately so markers can be added
            _isMapReady = true;
            System.Diagnostics.Debug.WriteLine("✅ [C#] Map HTML loaded, _isMapReady = true");
            await InitializeMapAsync();
        }
        else if (e.Result == WebNavigationResult.Failure)
        {
            System.Diagnostics.Debug.WriteLine("❌ WebView navigation failed! Using inline HTML fallback...");
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                var htmlSource = new HtmlWebViewSource
                {
                    BaseUrl = "https://unpkg.com/",
                    Html = GetInlineLeafletHtml()
                };
                MapWebView.Source = htmlSource;
            });
        }
    }

    private async Task InitializeMapAsync()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("🚀 [C#] InitializeMapAsync started");

            var istanbulLat = 41.015137;
            var istanbulLng = 28.979530;

            await Task.Delay(500);

            System.Diagnostics.Debug.WriteLine($"🗺️ [C#] Setting map center to Istanbul: {istanbulLat}, {istanbulLng}");
            await SetMapCenter(istanbulLat, istanbulLng, 12);

            await Task.Delay(500);

            var bounds = new MapBounds
            {
                North = istanbulLat + 0.1,
                South = istanbulLat - 0.1,
                East = istanbulLng + 0.15,
                West = istanbulLng - 0.15,
                Center = new MapCenter { Lat = istanbulLat, Lng = istanbulLng }
            };

            await _viewModel.ScanAsync(bounds);
            System.Diagnostics.Debug.WriteLine("✅ [C#] Initial scan completed for Istanbul");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"❌ [C#] Map init error: {ex.Message}");
            System.Diagnostics.Debug.WriteLine($"❌ [C#] Stack trace: {ex.StackTrace}");
        }
    }

    private void OnViewModelPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(MapViewModel.Markers))
        {
            MainThread.BeginInvokeOnMainThread(async () => await UpdateMapMarkersAsync());
        }
    }

    private async Task UpdateMapMarkersAsync()
    {
        System.Diagnostics.Debug.WriteLine($"📍 [C#] UpdateMapMarkersAsync called, _isMapReady={_isMapReady}");

        if (!_isMapReady)
        {
            System.Diagnostics.Debug.WriteLine("⚠️ [C#] Map not ready yet, skipping marker update");
            return;
        }

        try
        {
            System.Diagnostics.Debug.WriteLine($"📊 [C#] ViewModel has {_viewModel.Markers.Count} markers");

            var markersData = _viewModel.Markers
                .Where(m => m.Lat != 0 && m.Lng != 0)
                .Select(m => new
                {
                    id = m.Id.ToString(),
                    lat = m.Lat,
                    lng = m.Lng,
                    title = m.Title ?? "Untitled",
                    address = m.Address ?? "Unknown",
                    gender = m.Gender
                })
                .ToArray();

            var json = JsonSerializer.Serialize(markersData);
            var jsonBase64 = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(json));
            var script = $"updateMarkersFromBase64(\"{jsonBase64}\");";

            System.Diagnostics.Debug.WriteLine($"🚀 [C#] Calling JS: updateMarkersFromBase64 with {markersData.Length} markers");
            await EvalJSAsync(script);

            System.Diagnostics.Debug.WriteLine($"✅ [C#] Updated {markersData.Length} markers on map");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"❌ Error updating markers: {ex}");
        }
    }

    public async Task UpdateMapThemeAsync(string theme)
    {
        if (!_isMapReady) return;

        try
        {
            var script = $"window.setBasemapTheme('{theme}');";
            await EvalJSAsync(script);
            System.Diagnostics.Debug.WriteLine($"✅ Map theme updated to: {theme}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"❌ Map theme update error: {ex}");
        }
    }

    private async Task SetMapCenter(double lat, double lng, int zoom = 13)
    {
        try
        {
            var script = $"setMapCenter({lat.ToString(System.Globalization.CultureInfo.InvariantCulture)}, {lng.ToString(System.Globalization.CultureInfo.InvariantCulture)}, {zoom});";
            await EvalJSAsync(script);
            _isMapReady = true;
            System.Diagnostics.Debug.WriteLine($"✅ Map center set: {lat:F4}, {lng:F4}, zoom: {zoom}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"❌ Error setting map center: {ex}");
        }
    }

    private Task EvalJSAsync(string script)
    {
        return MainThread.InvokeOnMainThreadAsync(async () =>
        {
            try
            {
                await MapWebView.EvaluateJavaScriptAsync(script);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"JS eval error: {ex.Message}\nScript: {script}");
            }
        });
    }

    private void OnMapWebViewNavigating(object? sender, WebNavigatingEventArgs e)
    {
        if (e.Url.StartsWith("app://pin"))
        {
            e.Cancel = true;
            
            // Extract post ID from URL: app://pin?id=<guid>
            var uri = new Uri(e.Url);
            var query = uri.Query;
            
            if (query.StartsWith("?id="))
            {
                var postId = query.Substring(4);
                System.Diagnostics.Debug.WriteLine($"🔗 [C#] Pin clicked: {postId}");
                
                // Load post detail in ViewModel
                _ = _viewModel.LoadPostDetailAsync(Guid.Parse(postId));
            }
        }
    }
}
