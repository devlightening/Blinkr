using System.Net.Http.Headers;
using Blinkr.Mobile.Core.Api;
using Blinkr.Mobile.Core.Auth;
using Refit;
using Polly;

namespace Blinkr.Mobile.Core.Services;

public static class ApiClientFactory
{
    /// <summary>
    /// Creates an API client with authentication handler.
    /// Note: This is a legacy factory. New code should use DI from MauiProgram.
    /// </summary>
    public static (IApiClient api, HttpClient http) Create(string gatewayBaseUrl, IAuthService auth)
    {
        // Simple retry policy without Polly for now
        // TODO: Implement proper retry policy when needed

        // Create HttpClient with Auth Handler
        var httpClient = new HttpClient(new AuthHandler(auth))
        {
            BaseAddress = new Uri(gatewayBaseUrl),
            Timeout = TimeSpan.FromSeconds(30)
        };

        // Set User-Agent and Device Headers
        httpClient.DefaultRequestHeaders.UserAgent.ParseAdd($"BlinkrMobile/{AppInfo.Current.VersionString}");
        httpClient.DefaultRequestHeaders.Add("X-Device-Id", GetOrCreateDeviceId());
        httpClient.DefaultRequestHeaders.Add("X-App-Version", AppInfo.Current.VersionString);

        // Create Refit Client
        var apiClient = RestService.For<IApiClient>(httpClient, new RefitSettings
        {
            ContentSerializer = new SystemTextJsonContentSerializer()
        });

        return (apiClient, httpClient);
    }

    private static string GetOrCreateDeviceId()
    {
        const string key = "device_id";
        var deviceId = Preferences.Default.Get(key, string.Empty);
        
        if (string.IsNullOrEmpty(deviceId))
        {
            deviceId = Guid.NewGuid().ToString();
            Preferences.Default.Set(key, deviceId);
        }
        
        return deviceId;
    }

    private sealed class AuthHandler : DelegatingHandler
    {
        private readonly IAuthService _auth;

        public AuthHandler(IAuthService auth) : base(new HttpClientHandler())
        {
            _auth = auth;
        }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, 
            CancellationToken cancellationToken)
        {
            var token = await _auth.GetAccessTokenAsync();
            if (!string.IsNullOrEmpty(token))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }

            var response = await base.SendAsync(request, cancellationToken);

            // Log rate limit headers for debugging
            if (response.Headers.TryGetValues("RateLimit-Remaining", out var remaining))
            {
                System.Diagnostics.Debug.WriteLine($"Rate Limit Remaining: {remaining.FirstOrDefault()}");
            }

            return response;
        }
    }
}
