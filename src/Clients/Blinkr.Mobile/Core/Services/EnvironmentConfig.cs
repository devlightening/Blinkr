namespace Blinkr.Mobile.Core.Services;

public class EnvironmentConfig
{
    public string ApiBaseUrl { get; set; } = string.Empty;
    public string IdentityBaseUrl { get; set; } = string.Empty;
    public bool EnableLogging { get; set; }
    public int CacheTimeout { get; set; }
    public int RequestTimeout { get; set; }
    public int RetryCount { get; set; }
    public FeatureFlags Features { get; set; } = new();
}
