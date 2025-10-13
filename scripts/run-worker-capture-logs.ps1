# Run worker and capture first logs

cd "$PSScriptRoot\..\src\Services\WorkerService\Blinkr.Projections.Worker"

Write-Host "Starting Worker... Watch for Consumer messages and errors" -ForegroundColor Cyan
Write-Host ""

dotnet run 2>&1 | ForEach-Object {
    $line = $_
    
    # Highlight important patterns
    if ($line -match "Consumer|Received|MongoDB|Error|Exception") {
        Write-Host $line -ForegroundColor Yellow
    } elseif ($line -match "ZAFER|Successfully") {
        Write-Host $line -ForegroundColor Green
    } elseif ($line -match "HATA|ERROR|Failed") {
        Write-Host $line -ForegroundColor Red
    } else {
        Write-Host $line -ForegroundColor Gray
    }
}
