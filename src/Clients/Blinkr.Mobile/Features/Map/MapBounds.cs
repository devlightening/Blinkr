#if ANDROID
#endif

namespace Blinkr.Mobile.Features.Map;

// Helper class for map bounds
public class MapBounds
{
    public double North { get; set; }
    public double South { get; set; }
    public double East { get; set; }
    public double West { get; set; }
    public MapCenter? Center { get; set; }
    public int Zoom { get; set; }
}
