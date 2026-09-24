param(
    [string]$GatewayBaseUrl = "http://localhost:5080",
    [int]$Samples = 18
)

# plan-devam G9: API p50/p95 through the Gateway for the calls the map and feed make most. Budget: p95 < 300 ms.
# Local single-machine numbers (Docker on the same box); production needs its own measurement. The rate limit is
# 100 requests a minute, so the default stays under it.

$ErrorActionPreference = "Stop"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$user = "e2e_perf_$suffix"
$auth = Invoke-RestMethod -Method POST -Uri "$GatewayBaseUrl/api/auth/register" -ContentType "application/json" -Body (@{ userName = $user; email = "$user@blinkr.local"; password = "BlinkrSmoke!2026" } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($auth.token)" }

$calls = [ordered]@{
    "map bounds"      = "/api/map/bounds?south=39.90&west=32.80&north=39.95&east=32.88&sinceMinutes=180&limit=180"
    "places nearby"   = "/api/places/nearby?lat=39.92&lon=32.85&radiusMeters=1500"
    "discover nearby" = "/api/discover/nearby?lat=39.92&lon=32.85"
    "chat list"       = "/api/chat/conversations"
}

function Percentile([double[]]$values, [double]$p) {
    $sorted = $values | Sort-Object
    $index = [Math]::Ceiling($p * $sorted.Count) - 1
    return [Math]::Round($sorted[[Math]::Max(0, $index)], 0)
}

Write-Host "API latency via $GatewayBaseUrl ($Samples samples each, first call discarded as warm-up)"
$results = @()
foreach ($name in $calls.Keys) {
    $url = "$GatewayBaseUrl$($calls[$name])"
    try { Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers -TimeoutSec 30 | Out-Null } catch { }
    $times = @()
    for ($i = 0; $i -lt $Samples; $i++) {
        $watch = [Diagnostics.Stopwatch]::StartNew()
        try { Invoke-WebRequest -UseBasicParsing -Uri $url -Headers $headers -TimeoutSec 30 | Out-Null; $ok = $true } catch { $ok = $false }
        $watch.Stop()
        if ($ok) { $times += $watch.Elapsed.TotalMilliseconds }
    }
    if ($times.Count -eq 0) { Write-Host ("{0,-16} FAILED" -f $name); continue }
    $p50 = Percentile $times 0.5; $p95 = Percentile $times 0.95
    $verdict = if ($p95 -lt 300) { "OK" } else { "OVER BUDGET" }
    Write-Host ("{0,-16} p50 {1,5} ms   p95 {2,5} ms   {3}" -f $name, $p50, $p95, $verdict)
    $results += [pscustomobject]@{ Name = $name; P50 = $p50; P95 = $p95 }
}
