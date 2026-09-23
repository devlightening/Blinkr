param(
    [string]$GatewayBaseUrl = "http://localhost:5080",
    [string]$LogDirectory = "",
    [string]$WorkerContainer = "blinkr_projections_worker"
)

# BLK-LOGPRIV-01 (sinyal-mvp-plan Faz 10 P10.8, root CLAUDE.md 10.3/16): exact coordinates never reach the service logs.
# Publishes a signal, searches places and reads the map/discover/nearby feeds at a distinctive point, then scans only
# what the running services wrote during the test (dev-log files from their pre-test length, worker container logs
# since the start) for those coordinates. Needs the stack started by start-blinkr-dev.ps1 (logs in artifacts/dev-logs).

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]
if (-not $LogDirectory) { $LogDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) "artifacts\dev-logs" }

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Compress -Depth 5); $args.ContentType = "application/json; charset=utf-8" }
    $status = 0; $raw = ""
    try {
        $response = Invoke-WebRequest @args
        $status = [int]$response.StatusCode; $raw = [string]$response.Content
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        $status = [int]$response.StatusCode
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream()); $raw = $reader.ReadToEnd(); $reader.Dispose()
    }
    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) { try { $json = $raw | ConvertFrom-Json } catch { } }
    [pscustomobject]@{ Status = $status; Raw = $raw; Json = $json }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

Write-Host "BLK-LOGPRIV-01 log location privacy via $GatewayBaseUrl"
if (-not (Test-Path $LogDirectory)) { throw "Log directory not found: $LogDirectory" }

# A point with many decimals nobody else uses: its leading digits are what we look for in the logs.
$rand = New-Object System.Random
$latText = "39.9" + $rand.Next(10000, 99999).ToString() + "3"
$lonText = "32.8" + $rand.Next(10000, 99999).ToString() + "7"
$lat = [double]::Parse($latText, [Globalization.CultureInfo]::InvariantCulture)
$lon = [double]::Parse($lonText, [Globalization.CultureInfo]::InvariantCulture)
# Six characters after "39." are enough to identify the point (about 10 cm) and survive any float formatting.
$needles = @($latText.Substring(0, 8), $lonText.Substring(0, 8))

$logFiles = @(Get-ChildItem -Path $LogDirectory -Filter "*.log" | Where-Object { $_.Name -match '\.(stdout|stderr)\.log$' })
$offsets = @{}
foreach ($f in $logFiles) { $offsets[$f.FullName] = $f.Length }
$since = (Get-Date).ToUniversalTime().AddSeconds(-2).ToString("yyyy-MM-ddTHH:mm:ssZ")

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$userName = "logpriv_$suffix"
$reg = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
Check "register" ($reg.Status -eq 200 -or $reg.Status -eq 201) "HTTP $($reg.Status)"
$token = $reg.Json.token

$post = Invoke-Api -Method POST -Path "/api/posts" -Token $token -Body @{ title = "Log privacy $suffix"; content = "Log privacy smoke"; signalType = "Crowd"; signalValue = "Busy"; latitude = $lat; longitude = $lon; accuracyMeters = 20; locationName = "Test"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea" }
Check "publish a coordinate signal" ($post.Status -eq 201) "HTTP $($post.Status) $($post.Raw)"

$q = "lat=$latText&lon=$lonText"
$minLat = ($lat - 0.01).ToString("F6", [Globalization.CultureInfo]::InvariantCulture); $maxLat = ($lat + 0.01).ToString("F6", [Globalization.CultureInfo]::InvariantCulture)
$minLon = ($lon - 0.01).ToString("F6", [Globalization.CultureInfo]::InvariantCulture); $maxLon = ($lon + 0.01).ToString("F6", [Globalization.CultureInfo]::InvariantCulture)
$calls = @(
    "/api/places/nearby?$q&radiusMeters=600",
    "/api/places/search?q=kafe&$q",
    "/api/discover/nearby?$q&radiusMeters=2000&pageSize=10",
    "/api/posts-read/nearby?$q&radius=2000",
    "/api/map/nearby?$q&radiusMeters=1500",
    "/api/map/bounds?minLat=$minLat&minLon=$minLon&maxLat=$maxLat&maxLon=$maxLon&includeCatalogPlaces=true"
)
foreach ($path in $calls) {
    $r = Invoke-Api -Method GET -Path $path -Token $token
    Check "read $($path.Split('?')[0])" ($r.Status -lt 500) "HTTP $($r.Status)"
}
# The bounds edges are coordinates too (derived from the point), so they are part of what must not appear.
$needles += @($minLat.Substring(0, 8), $maxLat.Substring(0, 8), $minLon.Substring(0, 8), $maxLon.Substring(0, 8))
$needles = @($needles | Select-Object -Unique)

# Give the event bus, the worker and the place projection time to process (and log) the new signal.
Start-Sleep -Seconds 6

$leaks = New-Object System.Collections.Generic.List[string]
foreach ($f in $logFiles) {
    $start = [long]$offsets[$f.FullName]
    $stream = [System.IO.File]::Open($f.FullName, 'Open', 'Read', 'ReadWrite')
    try {
        if ($stream.Length -lt $start) { $start = 0 }   # rotated or restarted: scan the whole new file
        [void]$stream.Seek($start, 'Begin')
        $reader = New-Object System.IO.StreamReader($stream)
        $text = $reader.ReadToEnd()
    } finally { $stream.Dispose() }
    foreach ($n in $needles) { if ($text.Contains($n)) { $leaks.Add("$($f.Name) contains $n") } }
}
$dockerOk = $false
try {
    $workerLog = (& docker logs --since $since $WorkerContainer 2>&1 | Out-String)
    $dockerOk = $LASTEXITCODE -eq 0
    foreach ($n in $needles) { if ($workerLog.Contains($n)) { $leaks.Add("$WorkerContainer contains $n") } }
} catch { }
Check "worker container logs were readable" $dockerOk
Check "no exact coordinates in the service logs" ($leaks.Count -eq 0) ($leaks -join "; ")

if ($script:failures.Count -gt 0) {
    Write-Host "BLK-LOGPRIV-01 FAILED: $($script:failures -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "BLK-LOGPRIV-01 PASS"
