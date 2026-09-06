param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
    param([string]$Url)
    $response = Invoke-WebRequest -Method GET -Uri $Url -TimeoutSec 60 -UseBasicParsing
    if ([string]::IsNullOrWhiteSpace($response.Content)) { return $null }
    return $response.Content | ConvertFrom-Json
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

function Test-Finite {
    param([double]$Value)
    return -not ([double]::IsNaN($Value) -or [double]::IsInfinity($Value))
}

Write-Host "BLK-BETA-UX-02 nearby distance contract via $GatewayBaseUrl"

$originA = @{ lat = 39.9334; lon = 32.8597 }
$nearA = @(Invoke-Json "$GatewayBaseUrl/api/places/nearby?lat=$($originA.lat)&lon=$($originA.lon)&radiusMeters=1200&limit=20")
if ($nearA.Count -eq 1 -and $nearA[0] -is [System.Array]) { $nearA = $nearA[0] }
Assert-True ($nearA.Count -gt 0) "Origin A returned no places."

$place = $nearA | Select-Object -First 1
$placeId = [string]$place.id
$distanceA = [double]$place.distanceMeters
Assert-True ((Test-Finite $distanceA) -and $distanceA -ge 0) "Origin A distance is invalid."

$originB = @{ lat = [double]$place.latitude + 0.0072; lon = [double]$place.longitude }
$nearB = @(Invoke-Json "$GatewayBaseUrl/api/places/nearby?lat=$($originB.lat)&lon=$($originB.lon)&radiusMeters=1500&limit=80")
if ($nearB.Count -eq 1 -and $nearB[0] -is [System.Array]) { $nearB = $nearB[0] }
$samePlace = $nearB | Where-Object { $_.id -eq $placeId } | Select-Object -First 1
Assert-True ($null -ne $samePlace) "Same place was not discoverable from Origin B."

$distanceB = [double]$samePlace.distanceMeters
Assert-True ((Test-Finite $distanceB) -and $distanceB -ge 0) "Origin B distance is invalid."
Assert-True ([Math]::Abs($distanceB - $distanceA) -gt 250) "Distance appears stale; it did not change meaningfully across origins."

$farOnlyPrimary = @($nearA | Where-Object { [double]$_.distanceMeters -le 350 })
$extended = @($nearA | Where-Object { [double]$_.distanceMeters -gt 350 })
Assert-True (($farOnlyPrimary.Count + $extended.Count) -eq $nearA.Count) "Nearby response contains unknown or invalid distances."

Write-Host "PASS BLK-BETA-UX-02 nearby distance contract"
Write-Host "PlaceId: $placeId"
Write-Host "OriginADistanceMeters: $([Math]::Round($distanceA))"
Write-Host "OriginBDistanceMeters: $([Math]::Round($distanceB))"
