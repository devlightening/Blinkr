# SSL bypass
add-type @"
    using System.Net;
    using System.Security.Cryptography.X509Certificates;
    public class TrustAllCertsPolicy : ICertificatePolicy {
        public bool CheckValidationResult(
            ServicePoint srvPoint, X509Certificate certificate,
            WebRequest request, int certificateProblem) {
            return true;
        }
    }
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

Write-Host "Testing HTTPS Rate Limiting" -ForegroundColor Green

$uri = "https://localhost:7259/api/posts-read/nearby?lat=41.0082&lon=28.9784&radius=5000"

try {
    $response = Invoke-WebRequest -Uri $uri
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    
    $headers = $response.Headers
    Write-Host "📊 Rate Limit Headers Found:" -ForegroundColor Yellow
    
    if ($headers.ContainsKey("RateLimit-Limit")) {
        Write-Host "   RateLimit-Limit: $($headers['RateLimit-Limit'])" -ForegroundColor Cyan
    }
    if ($headers.ContainsKey("RateLimit-Remaining")) {
        Write-Host "   RateLimit-Remaining: $($headers['RateLimit-Remaining'])" -ForegroundColor Cyan
    }
    if ($headers.ContainsKey("RateLimit-Reset")) {
        Write-Host "   RateLimit-Reset: $($headers['RateLimit-Reset'])" -ForegroundColor Cyan
    }
    
    Write-Host "📄 Response: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))..." -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test completed!" -ForegroundColor Green
