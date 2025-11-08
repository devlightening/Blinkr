namespace Blinkr.Mobile.Features.Map;

public partial class MapPinView : ContentView
{
    public static readonly BindableProperty PostCountProperty =
        BindableProperty.Create(nameof(PostCount), typeof(int), typeof(MapPinView), 1);

    public static readonly BindableProperty IsSinglePostProperty =
        BindableProperty.Create(nameof(IsSinglePost), typeof(bool), typeof(MapPinView), true);

    public static readonly BindableProperty IsClusterProperty =
        BindableProperty.Create(nameof(IsCluster), typeof(bool), typeof(MapPinView), false);

    public static readonly BindableProperty GenderProperty =
        BindableProperty.Create(nameof(Gender), typeof(string), typeof(MapPinView), null);

    public int PostCount
    {
        get => (int)GetValue(PostCountProperty);
        set => SetValue(PostCountProperty, value);
    }

    public bool IsSinglePost
    {
        get => (bool)GetValue(IsSinglePostProperty);
        set => SetValue(IsSinglePostProperty, value);
    }

    public bool IsCluster
    {
        get => (bool)GetValue(IsClusterProperty);
        set => SetValue(IsClusterProperty, value);
    }

    public string? Gender
    {
        get => (string?)GetValue(GenderProperty);
        set => SetValue(GenderProperty, value);
    }

    public MapPinView()
    {
        InitializeComponent();
        BindingContext = this;
    }
}
