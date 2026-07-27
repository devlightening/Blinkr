param(
    [switch]$SkipDockerBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$logRoot = Join-Path $repoRoot "artifacts\dev-logs"
$pidFile = Join-Path $logRoot "mobile-backend-pids.json"
$script:servicePids = @()
if (Test-Path $pidFile) {
    try { $script:servicePids = @((Get-Content -Raw $pidFile | ConvertFrom-Json)) } catch { $script:servicePids = @() }
}
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null

function Test-PortListening {
    param([int]$Port)
    return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Wait-ContainerHealthy {
    param([string]$Container, [int]$TimeoutSeconds = 90)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $status = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $Container 2>$null
        if ($status -eq "healthy" -or $status -eq "running") {
            Write-Host "  OK  $Container ($status)" -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "$Container did not become healthy in $TimeoutSeconds seconds."
}

function Start-DotnetService {
    param(
        [string]$Name,
        [string]$Project,
        [int]$Port
    )

    if (Test-PortListening -Port $Port) {
        Write-Host "  OK  $Name already listens on :$Port" -ForegroundColor Green
        return
    }

    $stdout = Join-Path $logRoot "$Name.stdout.log"
    $stderr = Join-Path $logRoot "$Name.stderr.log"
    $arguments = "run --project `"$Project`" --urls `"http://0.0.0.0:$Port`""
    $process = Start-Process -FilePath "dotnet" -ArgumentList $arguments -WorkingDirectory $repoRoot `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
    $script:servicePids += $process.Id

    Write-Host "  ..  $Name starting on :$Port (PID $($process.Id))"
}

function Wait-HttpHealthy {
    param([string]$Name, [string]$Url, [int]$TimeoutSeconds = 120)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 4
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Host "  OK  $Name => $Url" -ForegroundColor Green
                return
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    throw "$Name did not answer at $Url. See $logRoot."
}

Push-Location $repoRoot
try {
    Write-Host "`n[1/4] Starting Blinkr infrastructure..." -ForegroundColor Cyan
    $composeArgs = @("compose", "up", "-d")
    if (-not $SkipDockerBuild) { $composeArgs += "--build" }
    $composeArgs += @("postgres", "redis", "eventstore.db", "rabbitmq", "mongodb", "projections-worker")
    & docker @composeArgs
    if ($LASTEXITCODE -ne 0) { throw "docker compose failed." }

    Write-Host "`n[2/4] Waiting for stateful services..." -ForegroundColor Cyan
    Wait-ContainerHealthy -Container "blinkr_postgres"
    Wait-ContainerHealthy -Container "blinkr_eventstore"
    Wait-ContainerHealthy -Container "blinkr_projections_worker" -TimeoutSeconds 140

    Write-Host "`n[3/4] Starting application services..." -ForegroundColor Cyan
    $identityProject = Join-Path $repoRoot "src\Services\IdentityService\IdentityService.Api\IdentityService.Api.csproj"
    $blogProject = Join-Path $repoRoot "src\Services\BlogService\BlogService.Api\BlogService.Api.csproj"
    $gatewayProject = Join-Path $repoRoot "src\Gateway\ApiGateway\ApiGateway.csproj"

    Start-DotnetService -Name "identity" -Project $identityProject -Port 5188
    Start-DotnetService -Name "blog" -Project $blogProject -Port 5215
    Start-DotnetService -Name "gateway" -Project $gatewayProject -Port 5080

    Write-Host "`n[4/4] Verifying HTTP health..." -ForegroundColor Cyan
    Wait-HttpHealthy -Name "Identity" -Url "http://localhost:5188/health"
    Wait-HttpHealthy -Name "Blog API" -Url "http://localhost:5215/health/liveness"
    Wait-HttpHealthy -Name "Gateway" -Url "http://localhost:5080/health"

    $lanAddress = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*" -and
            $_.InterfaceAlias -notmatch "vEthernet|Virtual|Default Switch|WSL|Loopback|Cloudflare|WARP|Docker"
        } |
        Sort-Object { if ($_.InterfaceAlias -match "Wi-Fi|Ethernet") { 0 } else { 1 } } |
        Select-Object -First 1

    Write-Host "`nBlinkr mobile backend is ready." -ForegroundColor Green
    ConvertTo-Json -InputObject @($script:servicePids | Sort-Object -Unique) | Set-Content -Encoding UTF8 $pidFile
    if ($null -ne $lanAddress) {
        Write-Host "Gateway LAN URL: http://$($lanAddress.IPAddress):5080"
    }
    Write-Host "Logs: $logRoot"
} finally {
    Pop-Location
}
