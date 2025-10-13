# Start Worker in console mode to see logs

Write-Host "[INFO] Starting Worker with console logging..." -ForegroundColor Cyan
Write-Host "[INFO] Check for MassTransit Bus messages and MongoDB connection" -ForegroundColor Yellow
Write-Host ""

cd "$PSScriptRoot\..\src\Services\WorkerService\Blinkr.Projections.Worker"

dotnet run 2>&1 | Select-String -Pattern "MassTransit|Mongo|Consumer|Queue|Bus|Error|Exception" -Context 0,1
