param(
    [switch]$Infrastructure
)

$ErrorActionPreference = "Continue"
$repoRoot = Split-Path $PSScriptRoot -Parent
$stateFile = Join-Path $repoRoot "artifacts\dev-runtime\processes.json"

if (Test-Path $stateFile) {
    $state = @()
    try { $state = @((Get-Content -Raw $stateFile | ConvertFrom-Json)) } catch { $state = @() }

    foreach ($entry in $state) {
        $pidValue = [int]$entry.pid
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $pidValue"
        if ($null -eq $processInfo) { continue }

        $commandLine = [string]$processInfo.CommandLine
        $project = [string]$entry.project
        if ($commandLine -like "*dotnet*" -and $commandLine -like "*$project*") {
            Stop-Process -Id $pidValue -Force
            Write-Host ("Stopped {0} PID {1}" -f $entry.serviceName, $pidValue)
        } else {
            Write-Host ("Skipped PID {0}; it is no longer the owned Blinkr process." -f $pidValue) -ForegroundColor Yellow
        }
    }

    Remove-Item -LiteralPath $stateFile -Force
} else {
    Write-Host "No Blinkr-owned application process state found."
}

if ($Infrastructure) {
    Push-Location $repoRoot
    try {
        docker compose stop projections-worker mongodb rabbitmq eventstore.db redis postgres
    } finally {
        Pop-Location
    }
    Write-Host "Blinkr Docker infrastructure stopped." -ForegroundColor Green
}

Write-Host "Blinkr dev application processes stopped." -ForegroundColor Green
