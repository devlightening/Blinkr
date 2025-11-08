using System.Net.Http;

namespace Blinkr.Mobile.Core.Auth;

/// <summary>
/// Helper to test Gateway connection
/// </summary>
public static class ConnectionTestHelper
{
    public static async Task<bool> TestGatewayConnectionAsync(string gatewayUrl, CancellationToken ct = default)
    {
        try
        {
            using var client = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(5)
            };
            
            var response = await client.GetAsync($"{gatewayUrl}/health", ct);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}

