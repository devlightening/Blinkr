using Refit;

namespace Blinkr.Mobile.Core.Api;

public class BlinkrApiClient : IBlinkrApiClient
{
    private readonly HttpClient _httpClient;

    public BlinkrApiClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    // This will be implemented with Refit interfaces
    // For now, it's a placeholder
}
