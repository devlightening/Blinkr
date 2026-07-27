$ErrorActionPreference = "Continue"
$repoRoot = Split-Path $PSScriptRoot -Parent
$pidFile = Join-Path $repoRoot "artifacts\dev-logs\mobile-backend-pids.json"

if (Test-Path $pidFile) {
    $processIds = @((Get-Content -Raw $pidFile | ConvertFrom-Json))
    foreach ($processId in $processIds) {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
        if ($null -ne $processInfo -and $processInfo.CommandLine -like "*$repoRoot*") {
            Stop-Process -Id $processId -Force
            Write-Host "Stopped Blinkr .NET process $processId"
        }
    }
    Remove-Item -LiteralPath $pidFile -Force
}

Push-Location $repoRoot
try {
    docker compose stop projections-worker mongodb rabbitmq eventstore.db redis postgres
} finally {
    Pop-Location
}

Write-Host "Blinkr mobile backend stopped." -ForegroundColor Green

