# Test Gateway Connection
Write-Host "Testing Gateway connection..." -ForegroundColor Yellow

# Test localhost:5100
Write-Host "`n1. Testing localhost:5100..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5100/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Gateway is running on localhost:5100" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Gateway is NOT running on localhost:5100" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}

# Test 10.0.2.2:5100 (Android emulator)
Write-Host "`n2. Testing 10.0.2.2:5100 (Android emulator)..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://10.0.2.2:5100/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Gateway is accessible from emulator (10.0.2.2:5100)" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Gateway is NOT accessible from emulator (10.0.2.2:5100)" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host "   Note: This is expected if Gateway is not running" -ForegroundColor Yellow
}

# Check if Gateway process is running
Write-Host "`n3. Checking Gateway process..." -ForegroundColor Cyan
$gatewayProcess = Get-Process -Name "ApiGateway" -ErrorAction SilentlyContinue
if ($gatewayProcess) {
    Write-Host "✅ Gateway process found (PID: $($gatewayProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "❌ Gateway process NOT found" -ForegroundColor Red
    Write-Host "   Start Gateway with: cd src/Gateway/ApiGateway && dotnet run" -ForegroundColor Yellow
}

Write-Host "`n---" -ForegroundColor Gray
Write-Host "To start Gateway:" -ForegroundColor Yellow
Write-Host "  cd src/Gateway/ApiGateway" -ForegroundColor White
Write-Host "  dotnet run" -ForegroundColor White

