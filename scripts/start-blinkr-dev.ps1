param(
    [switch]$SkipDockerBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$runtimeRoot = Join-Path $repoRoot "artifacts\dev-runtime"
$logRoot = Join-Path $repoRoot "artifacts\dev-logs"
$stateFile = Join-Path $runtimeRoot "processes.json"

$services = @(
    @{ Name = "IdentityService"; Port = 5188; Project = "src\Services\IdentityService\IdentityService.Api\IdentityService.Api.csproj"; Health = "http://localhost:5188/health"; Urls = "http://localhost:5188" },
    @{ Name = "BlogService"; Port = 5215; Project = "src\Services\BlogService\BlogService.Api\BlogService.Api.csproj"; Health = "http://localhost:5215/health/liveness"; Urls = "http://localhost:5215" },
    @{ Name = "PlaceService"; Port = 5225; Project = "src\Services\PlaceService\PlaceService.Api\PlaceService.Api.csproj"; Health = "http://localhost:5225/health"; Urls = "http://localhost:5225" },
    @{ Name = "NotificationsService"; Port = 5290; Project = "src\Services\NotificationsService\NotificationsService.Api\NotificationsService.Api.csproj"; Health = "http://localhost:5290/health"; Urls = "http://localhost:5290" },
    @{ Name = "ApiGateway"; Port = 5080; Project = "src\Gateway\ApiGateway\ApiGateway.csproj"; Health = "http://localhost:5080/health"; Urls = "http://0.0.0.0:5080" }
)

$containers = @(
    @{ Name = "MongoDB"; Container = "blinkr_mongodb"; Compose = "mongodb"; Port = 27017 },
    @{ Name = "PostgreSQL"; Container = "blinkr_postgres"; Compose = "postgres"; Port = 5432 },
    @{ Name = "Redis"; Container = "blinkr_redis"; Compose = "redis"; Port = 6379 },
    @{ Name = "RabbitMQ"; Container = "blinkr_rabbitmq"; Compose = "rabbitmq"; Port = 5672 },
    @{ Name = "EventStoreDB"; Container = "blinkr_eventstore"; Compose = "eventstore.db"; Port = 2113 },
    @{ Name = "ProjectionWorker"; Container = "blinkr_projections_worker"; Compose = "projections-worker"; Port = 8082 }
)

New-Item -ItemType Directory -Force -Path $runtimeRoot, $logRoot | Out-Null

function Assert-Prerequisite {
    param([string]$Command, [string]$FriendlyName)
    if ($null -eq (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "$FriendlyName is required but was not found in PATH."
    }
}

function Assert-DockerReady {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is not running or is not reachable. Start Docker Desktop and retry."
    }
}

function Get-ListeningConnection {
    param([int]$Port)
    Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Test-HttpOk {
    param([string]$Url, [int]$TimeoutSec = 3)
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec $TimeoutSec
        return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Wait-HttpReady {
    param([string]$Name, [string]$Url, [int]$TimeoutSeconds = 120)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpOk -Url $Url -TimeoutSec 4) {
            Write-Host ("  OK  {0} {1}" -f $Name, $Url) -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }

    $log = Join-Path $logRoot "$Name.stdout.log"
    Write-Host ("  FAIL {0} health did not become ready. Log: {1}" -f $Name, $log) -ForegroundColor Red
    if (Test-Path $log) {
        Get-Content $log -Tail 30
    }
    throw "$Name did not become ready at $Url."
}

function Wait-ContainerReady {
    param([hashtable]$Container, [int]$TimeoutSeconds = 150)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $status = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $Container.Container 2>$null
        if ($status -eq "healthy" -or $status -eq "running") {
            Write-Host ("  OK  {0} :{1} ({2})" -f $Container.Name, $Container.Port, $status) -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "$($Container.Name) did not become ready."
}

function Read-State {
    if (-not (Test-Path $stateFile)) { return @() }
    try { return @((Get-Content -Raw $stateFile | ConvertFrom-Json)) } catch { return @() }
}

function Save-State {
    param([array]$State)
    $State | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $stateFile
}

function Start-OwnedService {
    param([hashtable]$Service, [array]$CurrentState)

    $existing = Get-ListeningConnection -Port $Service.Port
    if ($null -ne $existing) {
        if (Test-HttpOk -Url $Service.Health -TimeoutSec 4) {
            Write-Host ("  OK  {0} already healthy on :{1}" -f $Service.Name, $Service.Port) -ForegroundColor Green
            return $CurrentState
        }

        throw ("Port :{0} is already occupied by PID {1}, but {2} is not healthy. Stop that process or run status-blinkr-dev.ps1." -f $Service.Port, $existing.OwningProcess, $Service.Name)
    }

    $projectPath = Join-Path $repoRoot $Service.Project
    if (-not (Test-Path $projectPath)) {
        throw "$($Service.Name) project file is missing: $projectPath"
    }

    $stdout = Join-Path $logRoot "$($Service.Name).stdout.log"
    $stderr = Join-Path $logRoot "$($Service.Name).stderr.log"
    # Built beforehand, one at a time (see [4/6]): parallel dotnet run builds raced on the shared DLLs.
    $arguments = @("run", "--no-build", "--project", "`"$projectPath`"", "--urls", "`"$($Service.Urls)`"") -join " "
    $process = Start-Process -FilePath "dotnet" -ArgumentList $arguments -WorkingDirectory $repoRoot -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru

    Write-Host ("  ..  {0} starting on :{1} (PID {2})" -f $Service.Name, $Service.Port, $process.Id)
    $entry = [pscustomobject]@{
        serviceName = $Service.Name
        pid = $process.Id
        port = $Service.Port
        startedAt = (Get-Date).ToString("o")
        project = $Service.Project
    }
    return @($CurrentState + $entry)
}

function Invoke-RouteSmoke {
    param([string]$Name, [string]$Url, [int[]]$AcceptedStatuses = @(200))
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 20
        $status = [int]$response.StatusCode
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw "$Name failed: $($_.Exception.Message)" }
        $status = [int]$response.StatusCode
    }

    if ($status -eq 502) { throw "$Name returned 502. A Gateway downstream service is not ready: $Url" }
    if ($AcceptedStatuses -notcontains $status) { throw "$Name returned HTTP $status from $Url" }
    Write-Host ("  OK  {0} HTTP {1}" -f $Name, $status) -ForegroundColor Green
}

function Get-LanAddress {
    Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*" -and
            $_.InterfaceAlias -notmatch "vEthernet|Virtual|Default Switch|WSL|Loopback|Cloudflare|WARP|Docker"
        } |
        Sort-Object { if ($_.InterfaceAlias -match "Wi-Fi|Ethernet") { 0 } else { 1 } } |
        Select-Object -First 1
}

Push-Location $repoRoot
try {
    Write-Host "`n[1/6] Checking prerequisites..." -ForegroundColor Cyan
    Assert-Prerequisite -Command "dotnet" -FriendlyName ".NET SDK"
    Assert-Prerequisite -Command "docker" -FriendlyName "Docker"
    Assert-DockerReady
    if (-not (Test-Path (Join-Path $repoRoot "docker-compose.yml"))) { throw "docker-compose.yml is missing." }
    if (-not (Test-Path (Join-Path $repoRoot ".env"))) { throw ".env is missing; copy .env.example to .env and fill it in." }
    # The Postgres password lives only in .env (not in git). The services get it the standard libpq way: PGPASSWORD for
    # the processes started here, and %APPDATA%\postgresql\pgpass.conf so Visual Studio and dotnet-ef work too.
    $pgUser = $null; $pgPassword = $null
    foreach ($line in Get-Content (Join-Path $repoRoot ".env")) {
        if ($line -match '^\s*POSTGRES_USER\s*=\s*(.+?)\s*$') { $pgUser = $Matches[1] }
        if ($line -match '^\s*POSTGRES_PASSWORD\s*=\s*(.+?)\s*$') { $pgPassword = $Matches[1] }
    }
    if (-not $pgUser -or -not $pgPassword) { throw ".env must define POSTGRES_USER and POSTGRES_PASSWORD." }
    $env:PGPASSWORD = $pgPassword
    $pgPassDir = Join-Path $env:APPDATA "postgresql"
    New-Item -ItemType Directory -Force -Path $pgPassDir | Out-Null
    $pgPassFile = Join-Path $pgPassDir "pgpass.conf"
    $entry = "localhost:5432:*:${pgUser}:" + ($pgPassword -replace '\\', '\\' -replace ':', '\:')
    $kept = @(); if (Test-Path $pgPassFile) { $kept = @(Get-Content $pgPassFile | Where-Object { $_ -notlike "localhost:5432:`*:${pgUser}:*" }) }
    Set-Content -Path $pgPassFile -Value (@($kept) + $entry) -Encoding ascii
    Write-Host "  OK  prerequisites" -ForegroundColor Green

    Write-Host "`n[2/6] Starting Docker infrastructure..." -ForegroundColor Cyan
    $composeArgs = @("compose", "up", "-d")
    if (-not $SkipDockerBuild) { $composeArgs += "--build" }
    $composeArgs += @($containers | ForEach-Object { $_.Compose })
    & docker @composeArgs
    if ($LASTEXITCODE -ne 0) { throw "docker compose up failed." }

    Write-Host "`n[3/6] Waiting for infrastructure..." -ForegroundColor Cyan
    foreach ($container in $containers) {
        Wait-ContainerReady -Container $container
    }

    Write-Host "`n[4/6] Starting application services..." -ForegroundColor Cyan
    $env:ASPNETCORE_ENVIRONMENT = "Development"
    # Build every service that is not already running, one after another. Four parallel `dotnet run` builds fought over
    # Shared/Shared.Events DLLs ("being used by another process") and a service randomly failed to start.
    foreach ($service in ($services | Where-Object { $null -eq (Get-ListeningConnection -Port $_.Port) })) {
        Write-Host ("  ..  building {0}" -f $service.Name)
        & dotnet build (Join-Path $repoRoot $service.Project) -v q -nologo | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "$($service.Name) did not build; run: dotnet build $($service.Project)" }
    }
    $state = Read-State
    foreach ($service in $services) {
        $state = Start-OwnedService -Service $service -CurrentState $state
        Save-State -State $state
    }

    Write-Host "`n[5/6] Waiting for service readiness..." -ForegroundColor Cyan
    foreach ($service in $services) {
        Wait-HttpReady -Name $service.Name -Url $service.Health
    }

    Write-Host "`n[6/6] Verifying Gateway downstream routes..." -ForegroundColor Cyan
    Invoke-RouteSmoke -Name "Gateway health" -Url "http://localhost:5080/health" -AcceptedStatuses @(200)
    Invoke-RouteSmoke -Name "Gateway auth proxy" -Url "http://localhost:5080/api/auth/register" -AcceptedStatuses @(404, 405)
    Invoke-RouteSmoke -Name "Gateway map bounds" -Url "http://localhost:5080/api/map/bounds?south=39.90&west=32.80&north=39.96&east=32.90&sinceMinutes=180&limit=20" -AcceptedStatuses @(200)
    Invoke-RouteSmoke -Name "Gateway nearby places" -Url "http://localhost:5080/api/places/nearby?lat=39.9334&lon=32.8597&radiusMeters=1000&limit=10" -AcceptedStatuses @(200)

    Write-Host "`n[Catalog] Checking regional Place coverage..." -ForegroundColor Cyan
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "test-place-catalog-coverage.ps1") -GatewayBaseUrl "http://localhost:5080"

    $lanAddress = Get-LanAddress
    Write-Host "`nBlinkr backend ready." -ForegroundColor Green
    Write-Host "Gateway local: http://localhost:5080"
    if ($null -ne $lanAddress) {
        $lanUrl = "http://$($lanAddress.IPAddress):5080"
        Write-Host "Gateway LAN:   $lanUrl"
        if (-not (Test-HttpOk -Url "$lanUrl/health" -TimeoutSec 4)) {
            Write-Host "Gateway works locally but is not reachable over LAN. Check that the phone is on the same Wi-Fi/LAN and allow inbound access to port 5080 in Windows Firewall if needed." -ForegroundColor Yellow
        }
        Write-Host "`nExpo:"
        Write-Host "cd src\Clients\Blinkr.Expo"
        Write-Host "set EXPO_PUBLIC_BLINKR_API_URL=$lanUrl"
        Write-Host "npx expo start --lan"
    } else {
        Write-Host "Gateway LAN:   no suitable LAN IPv4 address detected" -ForegroundColor Yellow
    }
    Write-Host "Logs: $logRoot"
} finally {
    Pop-Location
}
