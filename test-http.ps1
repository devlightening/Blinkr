Write-Host "Testing Rate Limiting via HTTP..." -ForegroundColor Green

# Test 1: Single request via HTTP
$uri = 'http://localhost:5000/api/posts-read/nearby?lat=41.0082&lon=28.9784&radius=5000'
try {
    $response = Invoke-WebRequest -Uri $uri
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    
    # Check rate limit headers
    $headers = $response.Headers
    Write-Host "📊 Rate Limit Headers:" -ForegroundColor Yellow
    foreach ($header in $headers.Keys) {
        if ($header -like "*RateLimit*" -or $header -eq "Retry-After") {
            Write-Host "   $header : $($headers[$header])" -ForegroundColor Cyan
        }
    }
    
    # Show response content length
    Write-Host "📄 Response Length: $($response.Content.Length) bytes" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "Test completed!" -ForegroundColor Green
