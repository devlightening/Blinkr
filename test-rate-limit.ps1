# Rate Limiting Test Suite
Write-Host "🧪 ENTERPRISE RATE LIMITING TEST SUITE" -ForegroundColor Green

# Test 1: Single request with headers
Write-Host "`n📋 TEST 1: Single Request + Headers" -ForegroundColor Yellow
$uri1 = "https://localhost:7259/api/posts-read/nearby?lat=41.0082&lon=28.9784&radius=5000"
try {
    $response1 = Invoke-WebRequest -Uri $uri1 -SkipCertificateCheck -Method GET
    Write-Host "✅ Status: $($response1.StatusCode)" -ForegroundColor Green
    Write-Host "📊 Headers:" -ForegroundColor Cyan
    $response1.Headers.GetEnumerator() | Where-Object { $_.Key -like "*RateLimit*" -or $_.Key -eq "Retry-After" } | ForEach-Object {
        Write-Host "   $($_.Key): $($_.Value)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Burst test (65 requests to hit 60/min limit)
Write-Host "`n🔥 TEST 2: Burst Test (65 requests)" -ForegroundColor Yellow
$successCount = 0
$rateLimitCount = 0

for ($i = 1; $i -le 65; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $uri1 -SkipCertificateCheck -Method GET -ErrorAction Stop
        $successCount++
        if ($i % 10 -eq 0) { Write-Host "   Request $i : HTTP $($response.StatusCode)" -ForegroundColor Green }
    } catch {
        $rateLimitCount++
        if ($_.Exception.Response.StatusCode -eq 429) {
            Write-Host "   Request $i : HTTP 429 (Rate Limited)" -ForegroundColor Red
            if ($rateLimitCount -eq 1) {
                # Show first 429 response details
                $errorResponse = $_.Exception.Response
                Write-Host "   📋 First 429 Response Headers:" -ForegroundColor Cyan
                $errorResponse.Headers.GetEnumerator() | Where-Object { $_.Key -like "*RateLimit*" -or $_.Key -eq "Retry-After" } | ForEach-Object {
                    Write-Host "      $($_.Key): $($_.Value)" -ForegroundColor White
                }
            }
        } else {
            Write-Host "   Request $i : Error $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`n📊 BURST TEST RESULTS:" -ForegroundColor Cyan
Write-Host "   ✅ Successful requests: $successCount" -ForegroundColor Green
Write-Host "   🚫 Rate limited (429): $rateLimitCount" -ForegroundColor Red
Write-Host "   🎯 Expected: ~60 success, ~5 rate limited" -ForegroundColor Yellow

# Test 3: Cooldown test
Write-Host "`n⏰ TEST 3: Cooldown Test (waiting 15 seconds)" -ForegroundColor Yellow
Write-Host "   Waiting for rate limit reset..." -ForegroundColor Gray
Start-Sleep -Seconds 15

try {
    $response3 = Invoke-WebRequest -Uri $uri1 -SkipCertificateCheck -Method GET
    Write-Host "✅ After cooldown: HTTP $($response3.StatusCode)" -ForegroundColor Green
    $remaining = $response3.Headers["RateLimit-Remaining"]
    Write-Host "   📊 RateLimit-Remaining: $remaining" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Cooldown test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Health check (should bypass rate limiting)
Write-Host "`n🏥 TEST 4: Health Check (should bypass)" -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "https://localhost:7259/health" -SkipCertificateCheck -Method GET
    Write-Host "✅ Health check: HTTP $($healthResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 RATE LIMITING TEST SUITE COMPLETED!" -ForegroundColor Green
