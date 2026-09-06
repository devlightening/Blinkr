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
    userName = "place_smoke_$suffix"
    email = $email
    password = $password
}
$authHeaders = @{
    Accept = "application/json"
    Authorization = "Bearer $($auth.body.token)"
}

$place = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/places" -Headers $authHeaders -ExpectedStatus @(201) -Body @{
    name = "Blinkr Core Test Place $suffix"
    category = "Cafe"
    latitude = 41.0082
    longitude = 28.9784
    displayAddress = "Istanbul smoke area"
    source = "SmokeTest"
}
$placeId = $place.body.id
Assert-Truthy $placeId "Place create did not return id."

$bounds = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/bounds?minLat=40.9&minLon=28.8&maxLat=41.2&maxLon=29.2&limit=50" -Headers $headers
Assert-Truthy ($bounds.body | Where-Object { $_.id -eq $placeId }) "Created place was not returned from bounds."

$nearby = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/nearby?lat=41.0082&lon=28.9784&radiusMeters=2000&limit=50" -Headers $headers
Assert-Truthy ($nearby.body | Where-Object { $_.id -eq $placeId }) "Created place was not returned from nearby."

$expiredPostId = [guid]::NewGuid().ToString()
Invoke-MongoEval "db.place_signals.updateOne({ _id: '$expiredPostId' }, { `$set: { _id: '$expiredPostId', PlaceId: '$placeId', SignalType: 'Crowd', SignalValue: 'EMPTY', Title: 'Expired signal', Text: 'Should not affect state', CreatedAtUtc: new Date(Date.now() - 7200000), ExpiresAtUtc: new Date(Date.now() - 3600000), LocationName: 'Expired location', Media: [] } }, { upsert: true })"

$post = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/posts" -Headers $authHeaders -ExpectedStatus @(201) -Body @{
    title = "Place is busy"
    content = "Many people are here now."
    latitude = 41.0082
    longitude = 28.9784
    accuracyMeters = 20
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

Write-Host "PASS BLK-CORE-02 place/live signal smoke" -ForegroundColor Green
Write-Host "PlaceId: $placeId"
Write-Host "PostId: $postId"
