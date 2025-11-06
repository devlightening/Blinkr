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
        
        // Subscribe to property changes
        _viewModel.PropertyChanged += OnViewModelPropertyChanged;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        
        System.Diagnostics.Debug.WriteLine("🚀 [C#] MapPage.OnAppearing called");
        
        // Load Leaflet map HTML
        LoadLeafletMap();
        
        // Subscribe to theme changes
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
                // Use platform-specific file URL
                var urlSource = new UrlWebViewSource { Url = url };
                MapWebView.Source = urlSource;
                System.Diagnostics.Debug.WriteLine($"✅ Loading Leaflet map from: {url}");
            }
            else
            {
                // Fallback to inline HTML
                var htmlSource = new HtmlWebViewSource();
                htmlSource.BaseUrl = "https://unpkg.com/";
                htmlSource.Html = GetInlineLeafletHtml();
                MapWebView.Source = htmlSource;
                System.Diagnostics.Debug.WriteLine("⚠️ Using inline HTML fallback");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"❌ Error loading Leaflet map: {ex}");
            // Fallback to inline HTML
            var htmlSource = new HtmlWebViewSource();
            htmlSource.BaseUrl = "https://unpkg.com/";
            htmlSource.Html = GetInlineLeafletHtml();
            MapWebView.Source = htmlSource;
        }
    }

    private string GetLeafletMapUrl()
    {
#if ANDROID
        // Android: MAUI assets with LogicalName="wwwroot/..." are packaged to android_asset/wwwroot/
        // Try multiple possible paths
        var possiblePaths = new[]
        {
            "file:///android_asset/wwwroot/leaflet-map.html",  // Standard MAUI path
            "file:///android_asset/leaflet-map.html",          // Alternative (if LogicalName is different)
        };
        
        // For now, return the standard path
        // If it fails, OnWebViewNavigated will catch and fall back to inline HTML
        System.Diagnostics.Debug.WriteLine($"🔍 Android: Trying asset path: {possiblePaths[0]}");
        return possiblePaths[0];
#elif WINDOWS
        // Windows: Use ms-appx-web scheme
        return "ms-appx-web:///wwwroot/leaflet-map.html";
#elif IOS || MACCATALYST
        // iOS: ms-appx-web also works
        return "ms-appx-web:///wwwroot/leaflet-map.html";
#else
        // Fallback: return empty to trigger inline HTML
        return string.Empty;
#endif
    }

    private string LoadLeafletHtml()
    {
        // Read the HTML file from wwwroot
        try
        {
            using var stream = FileSystem.OpenAppPackageFileAsync("wwwroot/leaflet-map.html").Result;
            using var reader = new StreamReader(stream);
            return reader.ReadToEnd();
        }
        catch
        {
            // Fallback: return inline HTML if file can't be loaded
            return GetInlineLeafletHtml();
        }
    }

    private string GetInlineLeafletHtml()
    {
        // Inline HTML as fallback (same as leaflet-map.html but embedded)
        return @"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"">
    <link rel=""stylesheet"" href=""https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"" />
    <link rel=""stylesheet"" href=""https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"" />
    <link rel=""stylesheet"" href=""https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #map { height: 100%; width: 100%; background: #0F172A; }
        .leaflet-popup-content-wrapper { background: #1E293B; color: #F8FAFC; border-radius: 12px; }
    </style>
</head>
<body>
    <div id=""map""></div>
    <script src=""https://unpkg.com/leaflet@1.9.4/dist/leaflet.js""></script>
    <script src=""https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js""></script>
    <script>
        let map, markers, markerMap = new Map();
        document.addEventListener('DOMContentLoaded', function() {
            map = L.map('map', { center: [41.0082, 28.9784], zoom: 13 });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
            markers = L.markerClusterGroup({ maxClusterRadius: 50 });
            map.addLayer(markers);
            window.invokeCSharpAction = function(action, data) {
                window.chrome.webview.postMessage(JSON.stringify({ action, data }));
            };
            if (window.invokeCSharpAction) window.invokeCSharpAction('MapReady', '{}');
        });
        function addMarker(m) {
            if (!m || !m.lat || !m.lng) return;
            const icon = L.divIcon({
                className: 'custom-marker',
                html: '<div style=""width:40px;height:40px;background:linear-gradient(135deg,#6366F1 0%,#8B5CF6 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;"">📍</div>',
                iconSize: [40, 40], iconAnchor: [20, 40]
            });
            const marker = L.marker([m.lat, m.lng], { icon });
            if (m.title) marker.bindPopup('<div><h3>' + (m.title || '') + '</h3><p>' + (m.address || '') + '</p></div>');
            marker.on('click', function() {
                if (window.invokeCSharpAction) window.invokeCSharpAction('MarkerClicked', JSON.stringify({ id: m.id, lat: m.lat, lng: m.lng, title: m.title }));
            });
            markers.addLayer(marker);
            if (m.id) markerMap.set(m.id, marker);
        }
        function clearMarkers() { markers.clearLayers(); markerMap.clear(); }
        function updateMarkers(arr) { clearMarkers(); arr.forEach(addMarker); }
        window.setMapCenter = function(lat, lng, z) { if (map) map.setView([lat, lng], z || 13); };
        window.addMapMarker = function(m) { addMarker(typeof m === 'string' ? JSON.parse(m) : m); };
        window.updateMapMarkers = function(arr) { updateMarkers(typeof arr === 'string' ? JSON.parse(arr) : arr); };
        window.clearMapMarkers = clearMarkers;
        window.addEventListener('message', function(e) {
            try { const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                if (d.action === 'setCenter') window.setMapCenter(d.lat, d.lng, d.zoom);
                else if (d.action === 'updateMarkers') window.updateMapMarkers(d.markers || []);
            } catch(ex) { console.error(ex); }
        });
    </script>
</body>
</html>";
    }

    private void OnWebViewNavigating(object? sender, WebNavigatingEventArgs e)
    {
        // Handle app:// scheme for JS → C# callbacks
        if (e.Url?.StartsWith("app://") == true)
        {
            e.Cancel = true;
            HandleAppScheme(e.Url);
            return;
        }
        
        // Allow navigation only to leaflet resources
        if (e.Url?.StartsWith("http") == true && 
            !e.Url.Contains("openstreetmap") && 
            !e.Url.Contains("unpkg.com") &&
            !e.Url.Contains("stadiamaps.com") &&
            !e.Url.Contains("cartodb.com") &&
            !e.Url.Contains("mapbox.com"))
        {
            e.Cancel = true;
        }
        
        // Allow file:// and ms-appx-web:// schemes (for local assets)
        if (e.Url?.StartsWith("file://") == true || 
            e.Url?.StartsWith("ms-appx-web://") == true)
        {
            // Allow local file access
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
                // Pin clicked - open bottom sheet
                var query = ParseQueryString(uri.Query);
                var id = query.GetValueOrDefault("id");
                var latStr = query.GetValueOrDefault("lat");
                var lngStr = query.GetValueOrDefault("lng");
                
                System.Diagnostics.Debug.WriteLine($"[MapPage] Pin ID: {id}");
                
                if (!string.IsNullOrEmpty(id) && Guid.TryParse(id, out var postId))
                {
                    System.Diagnostics.Debug.WriteLine($"[MapPage] Calling LoadPostDetailAsync...");
                    // Load full post detail
                    await _viewModel.LoadPostDetailAsync(postId);
                    System.Diagnostics.Debug.WriteLine($"[MapPage] LoadPostDetailAsync completed");
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"[MapPage] Invalid post ID: {id}");
                }
            }
            else if (uri.Host == "mapclick")
            {
                // Map clicked - close bottom sheet
                _viewModel.CloseBottomSheetCommand.Execute(null);
            }
            else if (uri.Host == "scan")
            {
                // "Gönderileri Tara" button clicked
                var query = ParseQueryString(uri.Query);
                var bbox = query.GetValueOrDefault("bbox");
                
                if (!string.IsNullOrEmpty(bbox))
                {
                    try
                    {
                        // Parse bbox string: "west,south,east,north"
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
                            // Fallback: scan with null (Istanbul default)
                            await _viewModel.ScanAsync(null);
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"❌ Scan bbox parse error: {ex.Message}");
                        // Fallback: scan with null
                        await _viewModel.ScanAsync(null);
                    }
                }
                else
                {
                    // No bbox provided, scan current viewport (Istanbul default)
                    await _viewModel.ScanAsync(null);
                }
            }
            else if (uri.Host == "mylocation")
            {
                // "Konumum" button clicked
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
            
            // Get location on background thread to avoid ANR
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
                // Navigate map to user location
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
        
        // Remove leading '?'
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
        System.Diagnostics.Debug.WriteLine($"🚀 [C#] OnWebViewNavigated called!");
        System.Diagnostics.Debug.WriteLine($"📄 [C#] WebView Navigated: Result={e.Result}, Url={e.Url}");
        
        if (e.Result == WebNavigationResult.Success)
        {
            System.Diagnostics.Debug.WriteLine("✅ WebView navigation successful, verifying Leaflet...");
            
            // Wait for DOM to load
            await Task.Delay(500);
            
            // Verify Leaflet loaded
            try
            {
                var leafletCheck = await MapWebView.EvaluateJavaScriptAsync("typeof L");
                System.Diagnostics.Debug.WriteLine($"🔍 Leaflet typeof: {leafletCheck}");
                
                if (leafletCheck == "undefined")
                {
                    System.Diagnostics.Debug.WriteLine("❌ Leaflet failed to load! Using inline HTML fallback...");
                    await MainThread.InvokeOnMainThreadAsync(() =>
                    {
                        var htmlSource = new HtmlWebViewSource();
                        htmlSource.BaseUrl = "https://unpkg.com/";
                        htmlSource.Html = GetInlineLeafletHtml();
                        MapWebView.Source = htmlSource;
                    });
                    return;
                }
                
                // Check HTML body content
                var bodyLength = await MapWebView.EvaluateJavaScriptAsync("document.body.innerHTML.length");
                System.Diagnostics.Debug.WriteLine($"📏 HTML body length: {bodyLength}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"⚠️ Leaflet verification error: {ex.Message}");
            }
            
            // Wait for map to initialize (DOMContentLoaded + map setup)
            await Task.Delay(1000);
            await InitializeMapAsync();
        }
        else if (e.Result == WebNavigationResult.Failure)
        {
            System.Diagnostics.Debug.WriteLine($"❌ WebView navigation failed! Trying inline HTML fallback...");
            // Asset loading failed, use inline HTML
            await MainThread.InvokeOnMainThreadAsync(() =>
            {
                var htmlSource = new HtmlWebViewSource();
                htmlSource.BaseUrl = "https://unpkg.com/";
                htmlSource.Html = GetInlineLeafletHtml();
                MapWebView.Source = htmlSource;
            });
        }
    }

    private async Task InitializeMapAsync()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("🚀 [C#] InitializeMapAsync started");
            
            // Always start with Istanbul center
            var istanbulLat = 41.015137;
            var istanbulLng = 28.979530;
            
            // Wait for WebView to be fully loaded
            await Task.Delay(1500);
            
            System.Diagnostics.Debug.WriteLine($"🗺️ [C#] Setting map center to Istanbul: {istanbulLat}, {istanbulLng}");
            await SetMapCenter(istanbulLat, istanbulLng, 12);
            
            // Wait a bit more for map to settle
            await Task.Delay(1000);
            
            System.Diagnostics.Debug.WriteLine("📍 [C#] Starting ScanAsync for Istanbul...");
            
            var bounds = new MapBounds
            {
                North = istanbulLat + 0.1,  // ~11km north
                South = istanbulLat - 0.1,  // ~11km south
                East = istanbulLng + 0.15,  // ~11km east
                West = istanbulLng - 0.15,  // ~11km west
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
        else if (e.PropertyName == nameof(MapViewModel.IsBottomSheetVisible))
        {
            MainThread.BeginInvokeOnMainThread(() => AnimateBottomSheet(_viewModel.IsBottomSheetVisible));
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
            // Use Markers collection from ViewModel
            var markersData = _viewModel.Markers
                .Where(m => m.Lat != 0 && m.Lng != 0) // Filter invalid coordinates
                .Select(m => new
                {
                    id = m.Id.ToString(),
                    lat = m.Lat,
                    lng = m.Lng,
                    title = m.Title ?? "Untitled",
                    address = m.Address ?? "Unknown"
                })
                .ToArray();

            var json = JsonSerializer.Serialize(markersData);
            System.Diagnostics.Debug.WriteLine($"📝 [C#] JSON: {json.Substring(0, Math.Min(200, json.Length))}...");
            
            // Pass JSON using base64 encoding to avoid escaping issues
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

    /// <summary>
    /// Update map theme (light/dark) via WebView
    /// </summary>
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

    /// <summary>
    /// Safely evaluate JavaScript on main thread
    /// </summary>
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

    /// <summary>
    /// Escape JSON string for JavaScript
    /// Note: JsonSerializer produces valid JSON, but when embedding in JS, we need to escape properly
    /// </summary>
    private static string EscapeForJavaScript(string json)
    {
        if (string.IsNullOrEmpty(json)) return "[]";
        // JsonSerializer produces valid JSON, but for embedding in JS string literal:
        // - Escape backslashes first (before other replacements)
        // - Escape quotes
        // - Escape newlines
        return json
            .Replace("\\", "\\\\")  // Escape backslashes first
            .Replace("\"", "\\\"")   // Escape quotes
            .Replace("\r\n", "\\n")  // Windows line breaks
            .Replace("\n", "\\n")    // Unix line breaks
            .Replace("\r", "\\r");   // Mac line breaks
    }

    private async void AnimateBottomSheet(bool show)
    {
        if (show)
        {
            BottomSheet.IsVisible = true;
            await BottomSheet.TranslateTo(0, 0, 300, Easing.CubicOut);
        }
        else
        {
            await BottomSheet.TranslateTo(0, 500, 250, Easing.CubicIn);
            BottomSheet.IsVisible = false;
        }
    }
}
