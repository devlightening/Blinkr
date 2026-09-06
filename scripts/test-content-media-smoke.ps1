param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
    param(
        [ValidateSet("GET", "POST", "PUT")]
        [string]$Method,
        [string]$Url,
        [object]$Body,
        [hashtable]$Headers = @{},
        [int[]]$ExpectedStatus = @(200)
    )

    try {
        $args = @{ Method = $Method; Uri = $Url; Headers = $Headers; TimeoutSec = 30; UseBasicParsing = $true }
        if ($null -ne $Body) { $args.ContentType = "application/json"; $args.Body = ($Body | ConvertTo-Json -Depth 10) }
        $response = Invoke-WebRequest @args
        if ($ExpectedStatus -notcontains [int]$response.StatusCode) { throw "Expected $($ExpectedStatus -join '/') got $($response.StatusCode) from $Url" }
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

function Register-User {
    param([string]$Prefix)
    $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $auth = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/auth/register" -Body @{
        userName = "$Prefix$suffix"
        email = "$Prefix$suffix@blinkr.local"
        password = "BlinkrSmoke!2026"
    }
    return @{ Accept = "application/json"; Authorization = "Bearer $($auth.body.token)" }
}

function Upload-Media {
    param([hashtable]$Headers, [string]$ContentType, [byte[]]$Bytes, [string]$FileName)

    $presign = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/v1/media/presign" -Headers $Headers -Body @{
        fileName = $FileName
        contentType = $ContentType
        sizeBytes = $Bytes.Length
        width = 1
        height = 1
    }
    $mediaId = $presign.body.mediaId
    Assert-Truthy $mediaId "Presign did not return mediaId."

    $uploadUrl = $presign.body.uploadUrl
    if ($uploadUrl.StartsWith("/")) { $uploadUrl = "$GatewayBaseUrl$uploadUrl" }
    Invoke-WebRequest -Method PUT -Uri $uploadUrl -Headers $Headers -ContentType $ContentType -Body $Bytes -UseBasicParsing -TimeoutSec 30 | Out-Null
    return $mediaId
}

function Create-Post {
    param([hashtable]$Headers, [object]$Body, [int[]]$ExpectedStatus = @(201))
    return Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/posts" -Headers $Headers -ExpectedStatus $ExpectedStatus -Body $Body
}

function Base-PostBody {
    return @{
        latitude = 41.0082
        longitude = 28.9784
        accuracyMeters = 20
        locationName = "Istanbul smoke area"
        audienceType = "Public"
        identityDisclosure = "LimitedProfile"
        locationPrecision = "PlaceCenter"
    }
}

Write-Host "BLK-CORE-03 content/media smoke via $GatewayBaseUrl" -ForegroundColor Cyan

$headersA = Register-User "content_a_"
$headersB = Register-User "content_b_"

$place = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/places" -Headers $headersA -ExpectedStatus @(201) -Body @{
    name = "Content Media Smoke Place"
    category = "Cafe"
    latitude = 41.0082
    longitude = 28.9784
    displayAddress = "Istanbul smoke area"
    source = "SmokeTest"
}
$placeId = $place.body.id

$png = [byte[]](0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x06,0x00,0x00,0x00,0x1F,0x15,0xC4,0x89)
$mp4 = [byte[]](0x00,0x00,0x00,0x18,0x66,0x74,0x79,0x70,0x69,0x73,0x6F,0x6D,0x00,0x00,0x02,0x00,0x69,0x73,0x6F,0x6D,0x69,0x73,0x6F,0x32)

$imageId = Upload-Media -Headers $headersA -ContentType "image/png" -Bytes $png -FileName "smoke.png"
$videoId = Upload-Media -Headers $headersA -ContentType "video/mp4" -Bytes $mp4 -FileName "smoke.mp4"
$otherImageId = Upload-Media -Headers $headersB -ContentType "image/png" -Bytes $png -FileName "other.png"

$base = Base-PostBody
Create-Post -Headers $headersA -Body ($base + @{ title = ""; content = ""; signalType = "Crowd"; signalValue = "BUSY" }) | Out-Null
Create-Post -Headers $headersA -Body ($base + @{ title = "Text only"; content = "Useful text only content"; signalType = "GeneralObservation" }) | Out-Null
Create-Post -Headers $headersA -Body ($base + @{ title = ""; content = ""; signalType = "GeneralObservation"; media = @(@{ mediaId = $imageId; mediaType = "Image" }) }) | Out-Null
Create-Post -Headers $headersA -Body ($base + @{ title = ""; content = ""; signalType = "GeneralObservation"; media = @(@{ mediaId = $videoId; mediaType = "Video" }) }) | Out-Null

$comboImageId = Upload-Media -Headers $headersA -ContentType "image/png" -Bytes $png -FileName "combo.png"
$combo = Create-Post -Headers $headersA -Body ($base + @{
    placeId = $placeId
    title = "Signal text media"
    content = "A real useful place signal with media."
    signalType = "Queue"
    signalValue = "LONG"
    media = @(@{ mediaId = $comboImageId; mediaType = "Image" })
})
$comboPostId = $combo.body.PostId
if (-not $comboPostId) { $comboPostId = $combo.body.postId }

Create-Post -Headers $headersA -ExpectedStatus @(400) -Body ($base + @{ title = ""; content = ""; signalType = "GeneralObservation"; media = @() }) | Out-Null
Create-Post -Headers $headersA -ExpectedStatus @(403) -Body ($base + @{ title = ""; content = ""; signalType = "GeneralObservation"; media = @(@{ mediaId = $otherImageId; mediaType = "Image" }) }) | Out-Null
Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/v1/media/presign" -Headers $headersA -ExpectedStatus @(400) -Body @{ fileName = "bad.txt"; contentType = "text/plain"; sizeBytes = 10 } | Out-Null

$detail = $null
$placeDetail = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    $detail = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/posts/$comboPostId"
    $placeDetail = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/places/$placeId"
    if (($detail.body.media | Where-Object { $_.url -match $comboImageId }) -and ($placeDetail.body.recentSignals | Where-Object { $_.postId -eq $comboPostId -and $_.media.Count -gt 0 })) {
        break
    }
}

Assert-Truthy ($detail.body.media | Where-Object { $_.url -match $comboImageId }) "Post detail did not include attached media."
Assert-Truthy ($placeDetail.body.recentSignals | Where-Object { $_.postId -eq $comboPostId -and $_.media.Count -gt 0 }) "Place read path did not include media activity."

Write-Host "PASS BLK-CORE-03 content/media smoke" -ForegroundColor Green
Write-Host "PlaceId: $placeId"
Write-Host "ComboPostId: $comboPostId"
