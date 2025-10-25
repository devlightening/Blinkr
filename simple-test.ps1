Write-Host "Testing Rate Limiting..." -ForegroundColor Green

# Test 1: Single request
$uri = 'https://localhost:7259/api/posts-read/nearby?lat=41.0082&lon=28.9784&radius=5000'
try {
    $response = Invoke-WebRequest -Uri $uri -SkipCertificateCheck
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    
    # Check rate limit headers
    $headers = $response.Headers
    if ($headers.ContainsKey('RateLimit-Limit')) {
        Write-Host "RateLimit-Limit: $($headers['RateLimit-Limit'])" -ForegroundColor Cyan
    }
    if ($headers.ContainsKey('RateLimit-Remaining')) {
        Write-Host "RateLimit-Remaining: $($headers['RateLimit-Remaining'])" -ForegroundColor Cyan
    }
    if ($headers.ContainsKey('RateLimit-Reset')) {
        Write-Host "RateLimit-Reset: $($headers['RateLimit-Reset'])" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test completed!" -ForegroundColor Green
