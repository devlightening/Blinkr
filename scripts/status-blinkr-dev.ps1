$ErrorActionPreference = "Continue"
$repoRoot = Split-Path $PSScriptRoot -Parent
$stateFile = Join-Path $repoRoot "artifacts\dev-runtime\processes.json"

$rows = New-Object System.Collections.Generic.List[object]

function Test-HttpStatus {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 4
        if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500) { return "HEALTHY" }
        return "HTTP $($response.StatusCode)"
    } catch {
        $response = $_.Exception.Response
        if ($null -ne $response) { return "HTTP $([int]$response.StatusCode)" }
        return "DOWN"
    }
}

function Test-NearbyCatalog {
    param([string]$Name, [double]$Lat, [double]$Lon)
    try {
        $url = "http://localhost:5080/api/places/nearby?lat=$Lat&lon=$Lon&radiusMeters=1500&limit=20"
        $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 8
        # Windows PowerShell 5.1 emits a JSON array as one object; ForEach-Object unrolls it.
        $items = @($response.Content | ConvertFrom-Json | ForEach-Object { $_ })
        $coverage = [string]$response.Headers["X-Blinkr-Place-Coverage"]
        if ($items.Count -gt 0 -and $coverage -ne "not_loaded") { return "READY ($($items.Count))" }
        return "MISSING"
    } catch {
        return "DOWN"
    }
}

function Get-ContainerStatus {
    param([string]$Container)
    $status = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $Container 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($status)) { return "DOWN" }
    if ($status -eq "healthy" -or $status -eq "running") { return "HEALTHY" }
    return $status.ToUpperInvariant()
}

function Add-Row {
    param([string]$Service, [string]$Port, [string]$Status)
    $rows.Add([pscustomobject]@{ Service = $Service; Port = $Port; Status = $Status }) | Out-Null
}

Add-Row "MongoDB" "27017" (Get-ContainerStatus "blinkr_mongodb")
Add-Row "PostgreSQL" "5432" (Get-ContainerStatus "blinkr_postgres")
Add-Row "Redis" "6379" (Get-ContainerStatus "blinkr_redis")
Add-Row "RabbitMQ" "5672" (Get-ContainerStatus "blinkr_rabbitmq")
Add-Row "EventStoreDB" "2113" (Get-ContainerStatus "blinkr_eventstore")
Add-Row "ProjectionWorker" "8082" (Get-ContainerStatus "blinkr_projections_worker")
Add-Row "IdentityService" "5188" (Test-HttpStatus "http://localhost:5188/health")
Add-Row "BlogService" "5215" (Test-HttpStatus "http://localhost:5215/health/liveness")
Add-Row "PlaceService" "5225" (Test-HttpStatus "http://localhost:5225/health")
Add-Row "Notifications" "5290" (Test-HttpStatus "http://localhost:5290/health")
Add-Row "ApiGateway" "5080" (Test-HttpStatus "http://localhost:5080/health")

Write-Host "`nBlinkr dev stack status`n" -ForegroundColor Cyan
$rows | Format-Table -AutoSize

Write-Host "Gateway route checks`n" -ForegroundColor Cyan
$routeRows = @(
    [pscustomobject]@{ Route = "/api/auth/register"; Status = Test-HttpStatus "http://localhost:5080/api/auth/register" },
    [pscustomobject]@{ Route = "/api/map/bounds"; Status = Test-HttpStatus "http://localhost:5080/api/map/bounds?south=39.90&west=32.80&north=39.96&east=32.90&sinceMinutes=180&limit=20" },
    [pscustomobject]@{ Route = "/api/places/nearby"; Status = Test-HttpStatus "http://localhost:5080/api/places/nearby?lat=39.9334&lon=32.8597&radiusMeters=1000&limit=10" }
)
$routeRows | Format-Table -AutoSize

Write-Host "Place catalog coverage`n" -ForegroundColor Cyan
$catalogRows = @(
    [pscustomobject]@{ Region = "Ankara"; Status = Test-NearbyCatalog "Ankara" 39.9334 32.8597 },
    [pscustomobject]@{ Region = "Istanbul"; Status = Test-NearbyCatalog "Istanbul" 41.0082 28.9784 },
    [pscustomobject]@{ Region = "Osmaniye"; Status = Test-NearbyCatalog "Osmaniye" 37.0746 36.2464 }
)
$catalogRows | Format-Table -AutoSize

$unhealthy = @($rows | Where-Object { $_.Status -ne "HEALTHY" })
$badRoutes = @($routeRows | Where-Object { $_.Status -eq "DOWN" -or $_.Status -eq "HTTP 502" })
$missingCatalog = @($catalogRows | Where-Object { $_.Status -eq "MISSING" })

# Dead letters (CLAUDE.md §16): failed messages must stay visible. Details and replay: scripts/error-queues.ps1.
Write-Host "`nError queues" -ForegroundColor Cyan
try {
    $errorSummary = & (Join-Path $PSScriptRoot "error-queues.ps1") 2>$null | Select-Object -Last 1
    if ($errorSummary -match "messages waiting: ([1-9][0-9]*)") { Write-Host "$errorSummary  -> scripts/error-queues.ps1 -Peek <queue>" -ForegroundColor Yellow } else { Write-Host $errorSummary }
} catch {
    Write-Host "Error queues: RabbitMQ management API not reachable" -ForegroundColor Yellow
}

if (Test-Path $stateFile) {
    Write-Host "Runtime state: $stateFile"
} else {
    Write-Host "Runtime state: not found"
}

if ($unhealthy.Count -eq 0 -and $badRoutes.Count -eq 0) {
    if ($missingCatalog.Count -gt 0) {
        Write-Host "Backend is ready, but Place catalog coverage is incomplete for: $(@($missingCatalog | ForEach-Object Region) -join ', ')." -ForegroundColor Yellow
    }
    Write-Host "`nREADY" -ForegroundColor Green
    exit 0
}

Write-Host "`nNOT READY" -ForegroundColor Red
exit 1
