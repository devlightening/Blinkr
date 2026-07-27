param(
    [string]$GatewayBaseUrl = "http://localhost:5080",
    [int]$ProjectionTimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"

function Assert-Equal {
    param([object]$Actual, [object]$Expected, [string]$Message)
    if ($Actual -ne $Expected) {
        throw "$Message. Expected='$Expected', Actual='$Actual'"
    }
}

function Wait-ForProjection {
    param([string]$PostId, [int]$PageSize)
    $deadline = (Get-Date).AddSeconds($ProjectionTimeoutSeconds)
    do {
        Start-Sleep -Seconds 1
        $url = "$GatewayBaseUrl/api/posts-read/bounds?minLat=39.8&minLng=32.5&maxLat=40.1&maxLng=32.8&sinceMinutes=180&pageSize=$PageSize"
        $response = Invoke-RestMethod -Uri $url -Method Get
        $match = @($response.items) | Where-Object { $_.id -eq $PostId } | Select-Object -First 1
        if ($match) { return $match }
    } while ((Get-Date) -lt $deadline)

    return $null
}

$stamp = Get-Date -Format "yyyyMMddHHmmssfff"
$userName = "structured_$stamp"
$registration = @{
    userName = $userName
    email = "$userName@blinkr.local"
    password = "BlinkrTest!123"
} | ConvertTo-Json

$auth = Invoke-RestMethod `
    -Uri "$GatewayBaseUrl/api/auth/register" `
    -Method Post `
    -ContentType "application/json" `
    -Body $registration

$headers = @{ Authorization = "Bearer $($auth.token)" }
$expiresAt = (Get-Date).ToUniversalTime().AddHours(1).ToString("o")
$publicSignal = @{
    title = "Crowd: Busy"
    content = ""
    media = @()
    latitude = 39.9278652939
    longitude = 32.6417046296
    accuracyMeters = 25
    locationName = "Ankara test area"
    signalType = "Crowd"
    signalValue = "Busy"
    audienceType = "Public"
    identityDisclosure = "AnonymousMap"
    locationPrecision = "ApproximateArea"
    expiresAt = $expiresAt
} | ConvertTo-Json

try {
    $created = Invoke-RestMethod `
        -Uri "$GatewayBaseUrl/api/posts" `
        -Method Post `
        -ContentType "application/json" `
        -Headers $headers `
        -Body $publicSignal
} catch {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    throw "Public signal create failed: $($reader.ReadToEnd())"
}

$postId = $created.postId
$projected = Wait-ForProjection -PostId $postId -PageSize 171
if (-not $projected) { throw "Public structured signal was not projected: $postId" }

Assert-Equal $projected.signalType "Crowd" "SignalType contract mismatch"
Assert-Equal $projected.signalValue "Busy" "SignalValue contract mismatch"
Assert-Equal $projected.audienceType "Public" "AudienceType contract mismatch"
Assert-Equal $projected.identityDisclosure "AnonymousMap" "IdentityDisclosure contract mismatch"
Assert-Equal $projected.locationPrecision "ApproximateArea" "LocationPrecision contract mismatch"
Assert-Equal $projected.sourceType "Community" "SourceType contract mismatch"
Assert-Equal $projected.latitude 39.928 "Public latitude was not reduced to an approximate area"
Assert-Equal $projected.longitude 32.642 "Public longitude was not reduced to an approximate area"
Assert-Equal $projected.authorId "00000000-0000-0000-0000-000000000000" "Anonymous author id was exposed"
if ($projected.authorName -eq $userName) { throw "Anonymous author name was exposed" }
if ($null -ne $projected.location) { throw "Raw GeoJSON location must not be returned by public bounds" }

$privateSignal = @{
    title = "Queue: 5-15 min"
    content = ""
    media = @()
    latitude = 39.9278652939
    longitude = 32.6417046296
    accuracyMeters = 25
    locationName = "Ankara private test area"
    signalType = "Queue"
    signalValue = "5To15"
    audienceType = "Private"
    identityDisclosure = "LimitedProfile"
    locationPrecision = "ApproximateArea"
    expiresAt = $expiresAt
} | ConvertTo-Json

$privateCreated = Invoke-RestMethod `
    -Uri "$GatewayBaseUrl/api/posts" `
    -Method Post `
    -ContentType "application/json" `
    -Headers $headers `
    -Body $privateSignal

Start-Sleep -Seconds 15
$privateInPublicBounds = Wait-ForProjection -PostId $privateCreated.postId -PageSize 169
if ($privateInPublicBounds) { throw "Private signal leaked into public bounds" }

$mongoScript = "db=db.getSiblingDB('BlinkrReadModel'); db.posts.countDocuments({_id:'$postId'})"
$mongoCount = (docker exec blinkr_mongodb mongosh --quiet --eval $mongoScript | Select-Object -Last 1).Trim()
Assert-Equal $mongoCount "1" "Projection is not idempotent by PostId"

Write-Host "PASS: BLK-COMPOSER-01 structured signal contract and integration smoke"
Write-Host "PublicPostId: $postId"
Write-Host "PrivatePostId: $($privateCreated.postId)"
