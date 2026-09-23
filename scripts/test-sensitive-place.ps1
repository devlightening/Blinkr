param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-SENSITIVE-01: a photo or video can never be posted to a school / kindergarten (EDUCATION) place -
# the server refuses it (422 MEDIA_NOT_ALLOWED_AT_PLACE); a text signal there still works, and media on an
# ordinary place still works (sinyal-mvp-plan 11_SAFETY §3, child safety).

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Compress -Depth 5); $args.ContentType = "application/json; charset=utf-8" }
    $status = 0; $raw = ""
    try {
        $response = Invoke-WebRequest @args
        $status = [int]$response.StatusCode; $raw = [string]$response.Content
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        $status = [int]$response.StatusCode
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream()); $raw = $reader.ReadToEnd(); $reader.Dispose()
    }
    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) { try { $json = $raw | ConvertFrom-Json } catch { } }
    [pscustomobject]@{ Status = $status; Raw = $raw; Json = $json }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

function Upload-Png {
    param([string]$Token)
    $png = [byte[]](0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x06,0x00,0x00,0x00,0x1F,0x15,0xC4,0x89)
    $presign = Invoke-Api -Method POST -Path "/api/v1/media/presign" -Token $Token -Body @{ fileName = "s.png"; contentType = "image/png"; sizeBytes = $png.Length; width = 1; height = 1 }
    if ($presign.Status -ne 200 -and $presign.Status -ne 201) { throw "presign failed: HTTP $($presign.Status)" }
    $uploadUrl = $presign.Json.uploadUrl
    if ($uploadUrl.StartsWith("/")) { $uploadUrl = "$GatewayBaseUrl$uploadUrl" }
    Invoke-WebRequest -Method PUT -Uri $uploadUrl -Headers @{ Authorization = "Bearer $Token" } -ContentType "image/png" -Body $png -UseBasicParsing -TimeoutSec 30 | Out-Null
    return $presign.Json.mediaId
}

function Find-Place {
    param([string]$Query, [string]$Category, [double]$Lat, [double]$Lon)
    $r = Invoke-Api -Method GET -Path "/api/places/search?q=$([uri]::EscapeDataString($Query))&lat=$Lat&lon=$Lon&radiusMeters=5000"
    return @($r.Json | Where-Object { $_.category -eq $Category } | Select-Object -First 1)[0]
}

function Post-At {
    param([string]$Token, $Place, [string]$MediaId, [string]$CapturedAt)
    $body = @{
        title = ""; content = "Sensitive place smoke"; signalType = "GeneralObservation"; placeId = $Place.id
        latitude = $Place.latitude; longitude = $Place.longitude; accuracyMeters = 20
        observationLatitude = $Place.latitude; observationLongitude = $Place.longitude; observationAccuracyMeters = 20
        locationName = $Place.name; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "PlaceCenter"
    }
    if ($MediaId) { $body.media = @(@{ mediaId = $MediaId; mediaType = "Image" }) }
    if ($CapturedAt) { $body.mediaCapturedAtUtc = $CapturedAt }
    return Invoke-Api -Method POST -Path "/api/posts" -Token $Token -Body $body
}

Write-Host "BLK-SENSITIVE-01 no media at schools via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$reg = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = "sens_$suffix"; email = "sens_$suffix@blinkr.local"; password = "BlinkrSmoke!2026" }
$token = $reg.Json.token

$school = Find-Place -Query "okul" -Category "EDUCATION" -Lat 39.92 -Lon 32.85
if (-not $school) { throw "The real catalog must contain an EDUCATION place near Ankara centre." }
$cafe = Find-Place -Query "kafe" -Category "CAFE" -Lat 39.92 -Lon 32.85
if (-not $cafe) { throw "The real catalog must contain a CAFE near Ankara centre." }

$blocked = Post-At -Token $token -Place $school -MediaId (Upload-Png -Token $token)
Check "photo at a school is refused (422 MEDIA_NOT_ALLOWED_AT_PLACE)" ($blocked.Status -eq 422 -and $blocked.Json.code -eq "MEDIA_NOT_ALLOWED_AT_PLACE") "HTTP $($blocked.Status) $($blocked.Raw)"
$text = Post-At -Token $token -Place $school
Check "a text signal at a school still works" ($text.Status -eq 201) "HTTP $($text.Status) $($text.Raw)"
$ok = Post-At -Token $token -Place $cafe -MediaId (Upload-Png -Token $token)
Check "a photo at an ordinary place still works" ($ok.Status -eq 201) "HTTP $($ok.Status) $($ok.Raw)"

# P5.11: a gallery photo taken hours ago still posts, but can never count as live.
function Trust-Of([string]$PlaceId, [string]$PostId) {
    for ($i = 0; $i -lt 30; $i++) {
        $signals = Invoke-Api -Method GET -Path "/api/places/$PlaceId/signals"
        $hit = @($signals.Json | ForEach-Object { $_ } | Where-Object { $_.postId -eq $PostId })
        if ($hit.Count -gt 0) { return $hit[0].publicationTrust }
        Start-Sleep -Milliseconds 500
    }
    return $null
}
$old = Post-At -Token $token -Place $cafe -MediaId (Upload-Png -Token $token) -CapturedAt ((Get-Date).ToUniversalTime().AddHours(-5).ToString("o"))
Check "an old gallery photo still posts" ($old.Status -eq 201) "HTTP $($old.Status) $($old.Raw)"
Check "an old gallery photo is not live (NEARBY_PLACE_POST)" ((Trust-Of $cafe.id $old.Json.postId) -eq "NEARBY_PLACE_POST")
Check "a fresh photo at the place is live (VERIFIED_LIVE)" ((Trust-Of $cafe.id $ok.Json.postId) -eq "VERIFIED_LIVE")

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-SENSITIVE-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    exit 1
}
Write-Host "`nPASS BLK-SENSITIVE-01 no media at schools"
