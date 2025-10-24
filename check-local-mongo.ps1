# Check Windows local MongoDB
Write-Host "Checking Windows local MongoDB on port 27017..." -ForegroundColor Yellow

# Try to connect using .NET MongoDB driver (if available)
# Or use netstat to check if port is listening
$port27017 = Get-NetTCPConnection -LocalPort 27017 -ErrorAction SilentlyContinue

if ($port27017) {
    Write-Host "Port 27017 is LISTENING - MongoDB is running locally" -ForegroundColor Green
    Write-Host "Process: $($port27017.OwningProcess)" -ForegroundColor Cyan
    
    # Get process name
    $process = Get-Process -Id $port27017.OwningProcess -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Process Name: $($process.ProcessName)" -ForegroundColor Cyan
    }
} else {
    Write-Host "Port 27017 is NOT listening" -ForegroundColor Red
}

Write-Host "`nTo stop Windows MongoDB (requires Admin):" -ForegroundColor Yellow
Write-Host "Stop-Service -Name MongoDB" -ForegroundColor White
