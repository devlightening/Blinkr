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

    $args = @{ Method = $Method; Uri = $Url; Headers = $Headers; TimeoutSec = 60; UseBasicParsing = $true }
    if ($null -ne $Body) {
        $jsonBody = $Body | ConvertTo-Json -Depth 10
        $args.ContentType = "application/json; charset=utf-8"
        $args.Body = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
    }

    try {
        $response = Invoke-WebRequest @args
    }
    catch {
        $errorResponse = $_.Exception.Response
        if ($null -ne $errorResponse) {
            $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
            $content = $reader.ReadToEnd()
            $status = [int]$errorResponse.StatusCode
            if ($ExpectedStatus -contains $status) {
                if ([string]::IsNullOrWhiteSpace($content)) { return $null }
                return $content | ConvertFrom-Json
            }
            throw "HTTP request failed for $Url :: $content"
        }
        throw
    }
    if ($ExpectedStatus -notcontains [int]$response.StatusCode) {
        throw "Expected $($ExpectedStatus -join '/') got $($response.StatusCode) from $Url"
    }
    if ([string]::IsNullOrWhiteSpace($response.Content)) { return $null }
    return $response.Content | ConvertFrom-Json
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

function Register-User {
    $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $auth = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/auth/register" -ExpectedStatus @(200) -Body @{
        userName = "nearby_ux_$suffix"
        email = "nearby_ux_$suffix@blinkr.local"
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
    $delta = 0.02
    return Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/map/bounds?south=$($Lat - $delta)&west=$($Lon - $delta)&north=$($Lat + $delta)&east=$($Lon + $delta)&sinceMinutes=180&limit=120"
}

Write-Host "BLK-LOCATION-02 nearby/place UX smoke via $GatewayBaseUrl"

$headers = Register-User
$lat = 39.9334
$lon = 32.8597

Write-Host "[A] Discovering nearby places..."
$nearby1 = @(Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/nearby?lat=$lat&lon=$lon&radiusMeters=1500&limit=30")
if ($nearby1.Count -eq 1 -and $nearby1[0] -is [System.Array]) { $nearby1 = $nearby1[0] }
Assert-True ($nearby1.Count -gt 0) "Nearby discovery returned no places."
Assert-True ((@($nearby1 | Where-Object { $_.id -and $_.name -and $_.category }).Count) -gt 0) "Nearby places are missing required display fields."

$categories = @($nearby1 | ForEach-Object { $_.category } | Sort-Object -Unique)
Assert-True (($categories.Count -gt 0) -and ($categories -notcontains "OTHER" -or $categories.Count -gt 1)) "Nearby categories were not normalized usefully."

$distances = @($nearby1 | ForEach-Object { [double]($_.distanceMeters) })
for ($i = 1; $i -lt $distances.Count; $i++) {
    Assert-True ($distances[$i] -ge $distances[$i - 1]) "Nearby places are not sorted by distance."
}

Write-Host "[B] Repeating discovery and checking duplicates..."
$nearby2 = @(Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/nearby?lat=$lat&lon=$lon&radiusMeters=1500&limit=30")
if ($nearby2.Count -eq 1 -and $nearby2[0] -is [System.Array]) { $nearby2 = $nearby2[0] }
$uniqueIds = @($nearby2 | ForEach-Object { $_.id } | Sort-Object -Unique)
Assert-True ($uniqueIds.Count -eq $nearby2.Count) "Nearby response contains duplicate place ids."

$place = $nearby2 | Select-Object -First 1
if ($place -is [System.Array]) { $place = $place[0] }
$placeId = [string](@($place.id) | Select-Object -First 1)
$placeName = [string](@($place.name) | Select-Object -First 1)
if ([string]::IsNullOrWhiteSpace($placeName) -or $placeName -eq "System.Object[]") { $placeName = "Nearby smoke place" }
$placeLat = [double](@($place.latitude) | Select-Object -First 1)
$placeLon = [double](@($place.longitude) | Select-Object -First 1)
Assert-True ($null -ne $place.id) "Selected nearby place has no internal id."

Write-Host "[C] Creating PLACE anchored signal..."
$placePost = Create-Post -Headers $headers -Body @{
    title = "Nearby place UX smoke"
    content = "Place anchored signal should light up this place on the map."
    latitude = $placeLat
    longitude = $placeLon
    accuracyMeters = 20
    observationLatitude = $placeLat
    observationLongitude = $placeLon
    observationAccuracyMeters = 20
    locationName = $placeName
    placeId = $placeId
    signalType = "GeneralObservation"
    audienceType = "Public"
    identityDisclosure = "LimitedProfile"
    locationPrecision = "PlaceCenter"
    expiresAt = (Get-Date).ToUniversalTime().AddHours(3).ToString("o")
}
$placePostId = $placePost.postId
if (-not $placePostId) { $placePostId = $placePost.PostId }
Assert-True ($placePost.anchorType -eq "PLACE" -or $placePost.AnchorType -eq "PLACE") "Place post did not return PLACE anchor."

Write-Host "[C2] Verifying far PLACE realtime signal is denied..."
$denied = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/posts" -Headers $headers -ExpectedStatus @(422) -Body @{
    title = "Too far place UX smoke"
    content = "Should be rejected because the observer is too far from the selected place."
    latitude = $placeLat
    longitude = $placeLon
    accuracyMeters = 20
    observationLatitude = $placeLat + 0.02
    observationLongitude = $placeLon + 0.02
    observationAccuracyMeters = 20
    locationName = $placeName
    placeId = $placeId
    signalType = "Crowd"
    signalValue = "Busy"
    audienceType = "Public"
    identityDisclosure = "LimitedProfile"
    locationPrecision = "PlaceCenter"
    expiresAt = (Get-Date).ToUniversalTime().AddHours(3).ToString("o")
}
Assert-True ($denied.error -eq "PLACE_PROXIMITY_REQUIRED") "Far place signal did not return PLACE_PROXIMITY_REQUIRED."

Write-Host "[D] Creating COORDINATE anchored signal..."
$coordinatePost = Create-Post -Headers $headers -Body @{
    title = "Coordinate UX regression"
    content = "Coordinate signal should still appear as an approximate signal marker."
    latitude = $lat
    longitude = $lon
    accuracyMeters = 25
    locationName = "Coordinate UX smoke"
    signalType = "GeneralObservation"
    audienceType = "Public"
    identityDisclosure = "LimitedProfile"
    locationPrecision = "ApproximateArea"
    expiresAt = (Get-Date).ToUniversalTime().AddHours(3).ToString("o")
}
$coordinatePostId = $coordinatePost.postId
if (-not $coordinatePostId) { $coordinatePostId = $coordinatePost.PostId }
Assert-True ($null -ne $coordinatePostId) "Coordinate post did not return postId."

Write-Host "[E] Waiting for map projection..."
$map = $null
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    $map = Get-Map -Lat $lat -Lon $lon
    $hasPlace = (@($map.places) | Where-Object { $_.id -eq $placeId -and $_.currentState.activeSignalCount -gt 0 }).Count -gt 0
    $hasSignal = (@($map.signals) | Where-Object { $_.postId -eq $coordinatePostId }).Count -gt 0
    if ($hasPlace -and $hasSignal) { break }
}

$projectedPlace = @($map.places) | Where-Object { $_.id -eq $placeId } | Select-Object -First 1
$projectedSignal = @($map.signals) | Where-Object { $_.postId -eq $coordinatePostId } | Select-Object -First 1
Assert-True ($null -ne $projectedPlace) "Unified map did not return the active PLACE marker."
Assert-True ([int]$projectedPlace.currentState.activeSignalCount -gt 0) "Active PLACE marker did not expose active signal state."
Assert-True ($null -ne $projectedSignal) "Unified map did not return the COORDINATE signal marker."
Assert-True (($projectedSignal.latitude -ne $lat) -or ($projectedSignal.longitude -ne $lon)) "Coordinate marker exposed exact original GPS."

Write-Host "PASS BLK-LOCATION-02 nearby/place UX smoke"
Write-Host "PlaceId: $placeId"
Write-Host "PlacePostId: $placePostId"
Write-Host "CoordinatePostId: $coordinatePostId"
Write-Host "NearbyCategories: $($categories -join ', ')"
