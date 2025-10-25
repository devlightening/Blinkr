# Ignore SSL certificate errors
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

Write-Host "Testing API Health..." -ForegroundColor Green

# Test health endpoint first
$healthUri = 'https://localhost:7259/health'
try {
    $response = Invoke-WebRequest -Uri $healthUri
    Write-Host "Health Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "API is running!" -ForegroundColor Green
} catch {
    Write-Host "Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "API may not be running or port may be different" -ForegroundColor Yellow
}

# Try HTTP instead of HTTPS
$httpHealthUri = 'http://localhost:5000/health'
try {
    $response = Invoke-WebRequest -Uri $httpHealthUri
    Write-Host "HTTP Health Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "HTTP Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Health test completed!" -ForegroundColor Green
