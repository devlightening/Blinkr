param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
    param(
        [ValidateSet("GET", "POST")]
        [string]$Method,
        [string]$Url,
        [object]$Body,
        [hashtable]$Headers = @{},
        [int[]]$ExpectedStatus = @(200)
    )

    $args = @{ Method = $Method; Uri = $Url; Headers = $Headers; TimeoutSec = 45; UseBasicParsing = $true }
    if ($null -ne $Body) {
        $args.ContentType = "application/json"
        $args.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    $response = Invoke-WebRequest @args
    if ($ExpectedStatus -notcontains [int]$response.StatusCode) {
        throw "Expected $($ExpectedStatus -join '/') got $($response.StatusCode) from $Url"
    }
    if ([string]::IsNullOrWhiteSpace($response.Content)) { return $null }
    return $response.Content | ConvertFrom-Json
}

function Assert-Truthy {
    param([object]$Value, [string]$Message)
    if (-not $Value) { throw $Message }
}

function Register-User {
    $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $auth = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/auth/register" -ExpectedStatus @(200) -Body @{
        userName = "location_smoke_$suffix"
        email = "location_smoke_$suffix@blinkr.local"
        password = "BlinkrSmoke!2026"
    }
    return @{ Accept = "application/json"; Authorization = "Bearer $($auth.token)" }
}

function Create-Post {
    param([hashtable]$Headers, [object]$Body)
    return Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/posts" -Headers $Headers -ExpectedStatus @(201) -Body $Body
}

function Get-Map {
    param([double]$Lat, [double]$Lon)
    $delta = 0.025
    return Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/map/bounds?south=$($Lat - $delta)&west=$($Lon - $delta)&north=$($Lat + $delta)&east=$($Lon + $delta)&sinceMinutes=180&limit=120"
}

Write-Host "BLK-LOCATION-01 location/map smoke via $GatewayBaseUrl"

$headers = Register-User
$lat = 41.0082
$lon = 28.9784

Write-Host "[A] Discovering nearby POIs..."
$nearby1 = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/nearby?lat=$lat&lon=$lon&radiusMeters=900&limit=20"
Assert-Truthy ($nearby1.Count -gt 0) "Nearby discovery returned no places."
$nearby2 = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/nearby?lat=$lat&lon=$lon&radiusMeters=900&limit=20"
$ids1 = @($nearby1 | ForEach-Object { $_.id } | Sort-Object -Unique)
$ids2 = @($nearby2 | ForEach-Object { $_.id } | Sort-Object -Unique)
Assert-Truthy ($ids2.Count -le ($ids1.Count + 2)) "Nearby discovery appears to create duplicates."
$place = $nearby2 | Select-Object -First 1
Assert-Truthy $place.id "Nearby place has no internal Blinkr id."

Write-Host "[B] Creating PLACE anchored post..."
$placePost = Create-Post -Headers $headers -Body @{
    title = "Place smoke signal"
    content = "Place current state smoke."
    latitude = $place.latitude
    longitude = $place.longitude
    accuracyMeters = 20
    observationLatitude = $place.latitude
    observationLongitude = $place.longitude
    observationAccuracyMeters = 20
    locationName = $place.name
    placeId = $place.id
    signalType = "Crowd"
    signalValue = "Busy"
    audienceType = "Public"
    identityDisclosure = "LimitedProfile"
    locationPrecision = "PlaceCenter"
    expiresAt = (Get-Date).ToUniversalTime().AddHours(3).ToString("o")
}
Assert-Truthy ($placePost.anchorType -eq "PLACE" -or $placePost.AnchorType -eq "PLACE") "Place post did not return PLACE anchor."

Write-Host "[C] Creating COORDINATE anchored post..."
$coordinatePost = Create-Post -Headers $headers -Body @{
    title = "Coordinate smoke signal"
    content = "Free coordinate observation."
    latitude = $lat
    longitude = $lon
    accuracyMeters = 25
    locationName = "Istanbul coordinate smoke"
    signalType = "GeneralObservation"
    audienceType = "Public"
    identityDisclosure = "LimitedProfile"
    locationPrecision = "ApproximateArea"
    expiresAt = (Get-Date).ToUniversalTime().AddHours(3).ToString("o")
}
$coordinatePostId = $coordinatePost.postId
if (-not $coordinatePostId) { $coordinatePostId = $coordinatePost.PostId }
Assert-Truthy $coordinatePostId "Coordinate post did not return postId."

Write-Host "[D] Waiting for unified map projection..."
$map = $null
for ($i = 0; $i -lt 12; $i++) {
    Start-Sleep -Seconds 2
    $map = Get-Map -Lat $lat -Lon $lon
    if ((@($map.signals) | Where-Object { $_.postId -eq $coordinatePostId }).Count -gt 0 -and @($map.places).Count -gt 0) { break }
}
$signal = @($map.signals) | Where-Object { $_.postId -eq $coordinatePostId } | Select-Object -First 1
Assert-Truthy $signal "Unified map did not return coordinate SIGNAL marker."
Assert-Truthy (@($map.places).Count -gt 0) "Unified map did not return PLACE markers."

Write-Host "[E] Verifying coordinate privacy..."
Assert-Truthy (($signal.latitude -ne $lat) -or ($signal.longitude -ne $lon)) "Coordinate marker exposed exact original GPS."

Write-Host "[F] Verifying expired coordinate signal exclusion..."
$expiredPost = Create-Post -Headers $headers -Body @{
    title = "Expired coordinate smoke"
    content = "Should not appear on active map."
    latitude = $lat
    longitude = $lon
    accuracyMeters = 25
    locationName = "Expired smoke"
    signalType = "GeneralObservation"
    audienceType = "Public"
    identityDisclosure = "LimitedProfile"
    locationPrecision = "ApproximateArea"
    expiresAt = (Get-Date).ToUniversalTime().AddSeconds(2).ToString("o")
}
$expiredPostId = $expiredPost.postId
if (-not $expiredPostId) { $expiredPostId = $expiredPost.PostId }
Start-Sleep -Seconds 6
$mapAfterExpired = Get-Map -Lat $lat -Lon $lon
Assert-Truthy ((@($mapAfterExpired.signals) | Where-Object { $_.postId -eq $expiredPostId }).Count -eq 0) "Expired coordinate signal appeared on active map."

Write-Host "PASS BLK-LOCATION-01 location/map smoke"
Write-Host "PlaceId: $($place.id)"
Write-Host "CoordinatePostId: $coordinatePostId"
