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

$unhealthy = @($rows | Where-Object { $_.Status -ne "HEALTHY" })
$badRoutes = @($routeRows | Where-Object { $_.Status -eq "DOWN" -or $_.Status -eq "HTTP 502" })

if (Test-Path $stateFile) {
    Write-Host "Runtime state: $stateFile"
} else {
    Write-Host "Runtime state: not found"
}

if ($unhealthy.Count -eq 0 -and $badRoutes.Count -eq 0) {
    Write-Host "`nREADY" -ForegroundColor Green
    exit 0
}

Write-Host "`nNOT READY" -ForegroundColor Red
exit 1
