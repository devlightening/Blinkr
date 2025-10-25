using System;
using System.Net.Http;
using System.Threading.Tasks;

class RateLimitTester
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("🧪 RATE LIMITING TEST SUITE");
        Console.WriteLine("============================");

        var handler = new HttpClientHandler()
        {
            ServerCertificateCustomValidationCallback = (message, cert, chain, errors) => true
        };
        
        using var client = new HttpClient(handler);
        
        // Test 1: Single request
        Console.WriteLine("\n📋 TEST 1: Single Request + Headers");
        await TestSingleRequest(client);
        
        // Test 2: Burst test
        Console.WriteLine("\n🔥 TEST 2: Burst Test (10 requests)");
        await TestBurst(client, 10);
        
        // Test 3: Health check
        Console.WriteLine("\n🏥 TEST 3: Health Check (should bypass)");
        await TestHealthCheck(client);
    }
    
    static async Task TestSingleRequest(HttpClient client)
    {
        try
        {
            var response = await client.GetAsync("https://localhost:7259/api/posts-read/nearby?lat=41.0082&lon=28.9784&radius=5000");
            
            Console.WriteLine($"✅ Status: {response.StatusCode}");
            
            // Check rate limit headers
            if (response.Headers.Contains("RateLimit-Limit"))
                Console.WriteLine($"   RateLimit-Limit: {string.Join(",", response.Headers.GetValues("RateLimit-Limit"))}");
            
            if (response.Headers.Contains("RateLimit-Remaining"))
                Console.WriteLine($"   RateLimit-Remaining: {string.Join(",", response.Headers.GetValues("RateLimit-Remaining"))}");
            
            if (response.Headers.Contains("RateLimit-Reset"))
                Console.WriteLine($"   RateLimit-Reset: {string.Join(",", response.Headers.GetValues("RateLimit-Reset"))}");
                
            var content = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"📄 Response Length: {content.Length} bytes");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error: {ex.Message}");
        }
    }
    
    static async Task TestBurst(HttpClient client, int requestCount)
    {
        int successCount = 0;
        int rateLimitCount = 0;
        
        for (int i = 1; i <= requestCount; i++)
        {
            try
            {
                var response = await client.GetAsync("https://localhost:7259/api/posts-read/nearby?lat=41.0082&lon=28.9784&radius=5000");
                
                if (response.IsSuccessStatusCode)
                {
                    successCount++;
                    Console.WriteLine($"   Request {i}: HTTP {(int)response.StatusCode}");
                }
                else if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    rateLimitCount++;
                    Console.WriteLine($"   Request {i}: HTTP 429 (Rate Limited)");
                    
                    if (response.Headers.Contains("Retry-After"))
                        Console.WriteLine($"      Retry-After: {string.Join(",", response.Headers.GetValues("Retry-After"))}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"   Request {i}: Error - {ex.Message}");
            }
        }
        
        Console.WriteLine($"\n📊 RESULTS:");
        Console.WriteLine($"   ✅ Successful: {successCount}");
        Console.WriteLine($"   🚫 Rate Limited: {rateLimitCount}");
    }
    
    static async Task TestHealthCheck(HttpClient client)
    {
        try
        {
            var response = await client.GetAsync("https://localhost:7259/health");
            Console.WriteLine($"✅ Health Status: {response.StatusCode}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Health Error: {ex.Message}");
        }
    }
}
