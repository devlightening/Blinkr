# Run Worker with verbose output to see what's happening

Write-Host "[INFO] Starting Worker in verbose mode..." -ForegroundColor Cyan
Write-Host "[INFO] Check for Environment, RabbitMQ connection, and Consumer registration" -ForegroundColor Yellow
Write-Host ""

cd "$PSScriptRoot\..\src\Services\WorkerService\Blinkr.Projections.Worker"

# Run and capture first 100 lines
dotnet run 2>&1 | Select-Object -First 100
