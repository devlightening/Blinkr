param(
    [string]$GatewayBaseUrl = "http://localhost:5080",
    [string]$MongoConnectionString = "mongodb://localhost:27017"
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

    try {
        $args = @{
            Method = $Method
            Uri = $Url
            Headers = $Headers
            TimeoutSec = 25
            UseBasicParsing = $true
        }
        if ($null -ne $Body) {
            $args.ContentType = "application/json"
            $args.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        $response = Invoke-WebRequest @args
        if ($ExpectedStatus -notcontains [int]$response.StatusCode) {
            throw "Expected $($ExpectedStatus -join '/') got $($response.StatusCode) from $Url"
        }
        if ([string]::IsNullOrWhiteSpace($response.Content)) { return @{ status = [int]$response.StatusCode; body = $null } }
        return @{ status = [int]$response.StatusCode; body = ($response.Content | ConvertFrom-Json) }
    } catch {
        $response = $_.Exception.Response
        if ($null -ne $response -and $ExpectedStatus -contains [int]$response.StatusCode) {
            return @{ status = [int]$response.StatusCode; body = $null }
        }
        throw
    }
}

function Assert-Truthy {
    param([object]$Value, [string]$Message)
    if (-not $Value) { throw $Message }
}

function Assert-Equal {
    param([object]$Actual, [object]$Expected, [string]$Message)
    if ($Actual -ne $Expected) { throw "$Message Expected '$Expected' got '$Actual'." }
}

function Invoke-MongoEval {
    param([string]$Script)

    if (Get-Command mongosh -ErrorAction SilentlyContinue) {
        & mongosh "$MongoConnectionString/BlinkrPlaces" --quiet --eval $Script | Out-Null
        return
    }

    if (Get-Command docker -ErrorAction SilentlyContinue) {
        & docker exec blinkr_mongodb mongosh "mongodb://localhost:27017/BlinkrPlaces" --quiet --eval $Script | Out-Null
        return
    }

    throw "mongosh was not found locally and docker is unavailable; cannot seed expired signal."
}

Write-Host "BLK-CORE-02 place/live signal smoke via $GatewayBaseUrl" -ForegroundColor Cyan

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "place_smoke_$suffix@blinkr.local"
$password = "BlinkrSmoke!2026"
$headers = @{ Accept = "application/json" }

$auth = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/auth/register" -Headers $headers -Body @{
    userName = "e2e_place_smoke_$suffix"
    email = $email
    password = $password
}
$authHeaders = @{
    Accept = "application/json"
    Authorization = "Bearer $($auth.body.token)"
}

$nearby = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/nearby?lat=39.9334&lon=32.8597&radiusMeters=1500&limit=100" -Headers $headers
$catalogPlace = $null
foreach ($candidate in $nearby.body) {
    if ($candidate.externalProvider -ne 'osm') { continue }
    $candidateDetail = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/$($candidate.id)" -Headers $headers
    if (@($candidateDetail.body.recentSignals).Count -eq 0) { $catalogPlace = $candidate; break }
}
Assert-Truthy $catalogPlace "No unused real catalog Place is available."
$placeId = $catalogPlace.id

$expiredPostId = [guid]::NewGuid().ToString()
Invoke-MongoEval "db.place_signals.updateOne({ _id: '$expiredPostId' }, { `$set: { _id: '$expiredPostId', PlaceId: '$placeId', SignalType: 'Crowd', SignalValue: 'EMPTY', Title: 'Expired signal', Text: 'Should not affect state', CreatedAtUtc: new Date(Date.now() - 7200000), ExpiresAtUtc: new Date(Date.now() - 3600000), LocationName: 'Expired location', Media: [] } }, { upsert: true })"

$post = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/posts" -Headers $authHeaders -ExpectedStatus @(201) -Body @{
    title = "Place is busy"
    content = "Many people are here now."
    latitude = $catalogPlace.latitude
    longitude = $catalogPlace.longitude
    accuracyMeters = 20
    observationLatitude = $catalogPlace.latitude
    observationLongitude = $catalogPlace.longitude
    observationAccuracyMeters = 20
    locationName = "Blinkr Core Test Place"
    placeId = $placeId
    signalType = "Crowd"
    signalValue = "BUSY"
    audienceType = "Public"
    identityDisclosure = "LimitedProfile"
    locationPrecision = "PlaceCenter"
}
$postId = $post.body.PostId
if (-not $postId) { $postId = $post.body.postId }
Assert-Truthy $postId "Post create did not return PostId."

$detail = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    $detail = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/$placeId" -Headers $headers
    if (($detail.body.recentSignals | Where-Object { $_.postId -eq $postId }) -and $detail.body.currentState.signalValue -eq "BUSY") {
        break
    }
}

Assert-Truthy ($detail.body.recentSignals | Where-Object { $_.postId -eq $postId }) "Fresh signal did not appear under place."
Assert-Equal $detail.body.currentState.signalValue "BUSY" "Current state did not favor fresh signal."
Assert-Truthy ($detail.body.currentState.confidence -in @("LOW", "MEDIUM", "HIGH")) "Confidence label missing."
if ($detail.body.recentSignals | Where-Object { $_.postId -eq $expiredPostId }) {
    throw "Expired signal appeared in recent active signals."
}

# One voice per person and signal type: repeating or re-confirming a value must not inflate the live state, and a
# second person agreeing must. (The state is computed by the server from verified signals only.)
function Publish-Crowd {
    param([hashtable]$AuthHeaders, [string]$Value)
    $created = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/posts" -Headers $AuthHeaders -ExpectedStatus @(201) -Body @{
        title = "Crowd $Value"
        content = ""
        latitude = $catalogPlace.latitude
        longitude = $catalogPlace.longitude
        accuracyMeters = 20
        observationLatitude = $catalogPlace.latitude
        observationLongitude = $catalogPlace.longitude
        observationAccuracyMeters = 20
        locationName = "Blinkr Core Test Place"
        placeId = $placeId
        signalType = "Crowd"
        signalValue = $Value
        audienceType = "Public"
        identityDisclosure = "LimitedProfile"
        locationPrecision = "PlaceCenter"
    }
    return $created
}
function Wait-PlaceSignals {
    param([int]$Count)
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        $d = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/$placeId" -Headers $headers
        if (@($d.body.recentSignals).Count -ge $Count) { return $d }
    }
    throw "Projection did not reach $Count signals for place $placeId."
}

$singleState = $detail.body.currentState
Assert-Equal ([int]$singleState.activeSignalCount) 1 "One person's first signal should count once."
Publish-Crowd -AuthHeaders $authHeaders -Value "BUSY" | Out-Null
Publish-Crowd -AuthHeaders $authHeaders -Value "BUSY" | Out-Null
$repeated = Wait-PlaceSignals -Count 3
Assert-Equal ([int]$repeated.body.currentState.activeSignalCount) 1 "The same person repeating a value must still count once."
Assert-Equal ([double]$repeated.body.currentState.confidenceValue) ([double]$singleState.confidenceValue) "Repeating a value must not raise confidence."

$second = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/auth/register" -Headers $headers -Body @{
    userName = "e2e_place_smoke_b_$suffix"
    email = "place_smoke_b_$suffix@blinkr.local"
    password = $password
}
$secondHeaders = @{ Accept = "application/json"; Authorization = "Bearer $($second.body.token)" }
Publish-Crowd -AuthHeaders $secondHeaders -Value "BUSY" | Out-Null
$agreed = Wait-PlaceSignals -Count 4
Assert-Equal ([int]$agreed.body.currentState.activeSignalCount) 2 "A second person agreeing should make two voices."
Assert-Truthy ([double]$agreed.body.currentState.confidenceValue -gt [double]$singleState.confidenceValue) "Two people agreeing must raise confidence."

# The first person now says it changed: their four earlier posts collapse into one voice, replaced by the newest.
Publish-Crowd -AuthHeaders $authHeaders -Value "CALM" | Out-Null
$changed = Wait-PlaceSignals -Count 5
Assert-Equal ([int]$changed.body.currentState.activeSignalCount) 2 "A person changing their signal must still be one voice (2 people in total)."
Write-Host "PASS one voice per person" -ForegroundColor Green

Write-Host "PASS BLK-CORE-02 place/live signal smoke" -ForegroundColor Green
Write-Host "PlaceId: $placeId"
Write-Host "PostId: $postId"
