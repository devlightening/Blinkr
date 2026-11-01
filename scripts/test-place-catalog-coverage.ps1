param(
    [string]$GatewayBaseUrl = "http://localhost:5080",
    [int]$RadiusMeters = 1500,
    [int]$Limit = 20,
    [switch]$Strict
)

$ErrorActionPreference = "Stop"

$regions = @(
    [pscustomobject]@{ Name = "Ankara"; Lat = 39.9334; Lon = 32.8597 },
    [pscustomobject]@{ Name = "Istanbul"; Lat = 41.0082; Lon = 28.9784 },
    [pscustomobject]@{ Name = "Osmaniye"; Lat = 37.0746; Lon = 36.2464 }
)

$rows = foreach ($region in $regions) {
    $query = "lat=$($region.Lat)&lon=$($region.Lon)&radiusMeters=$RadiusMeters&limit=$Limit"
    $url = "$GatewayBaseUrl/api/places/nearby?$query"
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 20
        # Windows PowerShell 5.1 emits a JSON array as one object; ForEach-Object unrolls it.
        $items = @($response.Content | ConvertFrom-Json | ForEach-Object { $_ })
        [pscustomobject]@{
            Region = $region.Name
            Status = [int]$response.StatusCode
            Count = $items.Count
            Coverage = [string]$response.Headers["X-Blinkr-Place-Coverage"]
            NearestMeters = if ($items.Count -gt 0 -and $null -ne $items[0].distanceMeters) { [math]::Round([double]$items[0].distanceMeters) } else { $null }
        }
    } catch {
        [pscustomobject]@{
            Region = $region.Name
            Status = "DOWN"
            Count = 0
            Coverage = ""
            NearestMeters = $null
        }
    }
}

Write-Host "`nBlinkr place catalog coverage`n" -ForegroundColor Cyan
$rows | Format-Table -AutoSize

$missing = @($rows | Where-Object { $_.Status -ne 200 -or $_.Count -eq 0 -or $_.Coverage -eq "not_loaded" })
if ($missing.Count -gt 0) {
    Write-Host "Place catalog coverage is incomplete for: $(@($missing | ForEach-Object Region) -join ', ')." -ForegroundColor Yellow
    Write-Host "Backend may be READY, but nearby Place selection will fall back to coordinate posting in those regions." -ForegroundColor Yellow
    if ($Strict) { exit 1 }
}

if ($missing.Count -eq 0) {
    Write-Host "Place catalog coverage OK." -ForegroundColor Green
}
