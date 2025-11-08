using System.Text.Json;

namespace Blinkr.Mobile.Core.Services;

public class EnvironmentService
{
    private readonly EnvironmentConfig _config;

    public EnvironmentService()
    {
        _config = LoadEnvironmentConfig();
    }

    public EnvironmentConfig Current => _config;

    private static EnvironmentConfig LoadEnvironmentConfig()
    {
        try
        {
            var environmentName = GetEnvironmentName();
            var json = LoadEnvironmentJson();
            var environments = JsonSerializer.Deserialize<Dictionary<string, EnvironmentConfig>>(json);
            
            if (environments?.TryGetValue(environmentName, out var config) == true)
            {
                return config;
            }

            // Fallback to Development
            return environments?["Development"] ?? new EnvironmentConfig
            {
                ApiBaseUrl = "http://10.0.2.2:5215",
                IdentityBaseUrl = "http://10.0.2.2:7122",
                EnableLogging = true,
                CacheTimeout = 300,
                RequestTimeout = 30,
                RetryCount = 3
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to load environment config: {ex.Message}");
            
            // Return safe defaults
            return new EnvironmentConfig
            {
                ApiBaseUrl = "http://10.0.2.2:5215",
                IdentityBaseUrl = "http://10.0.2.2:7122",
                EnableLogging = true,
                CacheTimeout = 300,
                RequestTimeout = 30,
                RetryCount = 3
            };
        }
    }

    private static string GetEnvironmentName()
    {
#if DEBUG
        return "Development";
#elif STAGING
        return "Staging";
#else
        return "Production";
#endif
    }

    private static string LoadEnvironmentJson()
    {
        using var stream = FileSystem.OpenAppPackageFileAsync("environments.json").Result;
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
