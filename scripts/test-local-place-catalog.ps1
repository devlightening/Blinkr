param(
    [Parameter(Mandatory = $true)]
    [double]$Latitude,
    [Parameter(Mandatory = $true)]
    [double]$Longitude,
    [int]$RadiusMeters = 1000,
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

$ErrorActionPreference = "Stop"

$url = "$GatewayBaseUrl/api/places/nearby?lat=$Latitude&lon=$Longitude&radiusMeters=$RadiusMeters&limit=20"
$response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 15
$coverage = $response.Headers["X-Blinkr-Place-Coverage"]
$items = if ([string]::IsNullOrWhiteSpace($response.Content)) { @() } else { @($response.Content | ConvertFrom-Json | ForEach-Object { $_ }) }

Write-Host "Coverage: $coverage"
Write-Host "Count: $($items.Count)"
Write-Host "Total candidates: $($items.Count)"
Write-Host "Within 100m: $(@($items | Where-Object { [double]$_.DistanceMeters -le 100 }).Count)"
Write-Host "Within 200m: $(@($items | Where-Object { [double]$_.DistanceMeters -le 200 }).Count)"
Write-Host "Within 350m: $(@($items | Where-Object { [double]$_.DistanceMeters -le 350 }).Count)"
Write-Host "Within 1000m: $(@($items | Where-Object { [double]$_.DistanceMeters -le 1000 }).Count)"

if ($items.Count -eq 0) {
    Write-Host "No local places returned."
    return
}

$items |
    Sort-Object DistanceMeters |
    Select-Object Name, Category, @{ Name = "DistanceMeters"; Expression = { [math]::Round([double]$_.DistanceMeters) } }, ExternalProvider, ExternalId |
    Format-Table -AutoSize
