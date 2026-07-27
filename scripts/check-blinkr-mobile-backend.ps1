$ErrorActionPreference = "Continue"

$checks = @(
    @{ Name = "Gateway"; Url = "http://localhost:5080/health" },
    @{ Name = "Identity"; Url = "http://localhost:5188/health" },
    @{ Name = "Blog API"; Url = "http://localhost:5215/health/liveness" },
    @{ Name = "Projection worker"; Url = "http://localhost:8082/health" }
)

Write-Host "Blinkr mobile backend health`n" -ForegroundColor Cyan
foreach ($check in $checks) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $check.Url -TimeoutSec 5
        Write-Host "[OK]   $($check.Name.PadRight(18)) $($check.Url)" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] $($check.Name.PadRight(18)) $($check.Url)" -ForegroundColor Red
    }
}

Write-Host "`nDocker services"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

