param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-LOCPRIV-01 (CLAUDE.md §10.3 "Privacy by default"): a coordinate signal posted from a precise device position and
# observation point never shows those exact numbers on any read path another person can call (map bounds, signal
# detail, nearby lists, feeds, author lists, Kesfet, hashtag feed); the public position is rounded (3 decimals, ~100 m).
# (The legacy /api/posts-read/nearby has a 60 s response cache, so a new signal may not be listed yet: only its leak
# check applies.)

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress -Depth 5)); $args.ContentType = "application/json; charset=utf-8" }
    $status = 0; $text = ""
    try {
        $response = Invoke-WebRequest @args
        $status = [int]$response.StatusCode
        $text = [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray())
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        $status = [int]$response.StatusCode
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream(), [Text.Encoding]::UTF8); $text = $reader.ReadToEnd(); $reader.Dispose()
    }
    [pscustomobject]@{ Status = $status; Raw = $text }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

function Register-SmokeUser([string]$Label, [string]$Suffix) {
    $userName = "e2e_locpriv_${Label}_$Suffix"
    $r = Invoke-RestMethod -Method Post -Uri "$GatewayBaseUrl/api/auth/register" -ContentType "application/json" -Body (@{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" } | ConvertTo-Json)
    [pscustomobject]@{ Token = $r.token; Id = $r.userId }
}

Write-Host "BLK-LOCPRIV-01 location privacy via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$author = Register-SmokeUser "author" $suffix
$reader = Register-SmokeUser "reader" $suffix

# A precise, unusual position (its own spot so the lists are small) and a slightly different observation point.
$lat = 37.0 + (Get-Random -Minimum 100000 -Maximum 999999) / 10000000 + 0.03
$lon = 36.2 + (Get-Random -Minimum 100000 -Maximum 999999) / 10000000 + 0.03
$obsLat = $lat + 0.0000137; $obsLon = $lon - 0.0000211
$exact = @(("{0:F6}" -f $lat), ("{0:F6}" -f $lon), ("{0:F6}" -f $obsLat), ("{0:F6}" -f $obsLon)) | ForEach-Object { $_.Replace(',', '.') }
$tag = "konumgizli$suffix"
$post = Invoke-Api -Method POST -Path "/api/posts" -Token $author.Token -Body @{
    title = ""; content = "Konum gizliligi #$tag"; latitude = $lat; longitude = $lon; accuracyMeters = 8
    observationLatitude = $obsLat; observationLongitude = $obsLon; observationAccuracyMeters = 8
    locationName = "Sokak"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea"
}
$postId = $post.Json.postId
if (-not $postId) { $postId = ($post.Raw | ConvertFrom-Json).postId }
Check "a precise coordinate signal is posted" ($post.Status -eq 201 -and $postId) "HTTP $($post.Status) $($post.Raw)"
for ($i = 0; $i -lt 30; $i++) { if ((Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $reader.Token).Status -eq 200) { break }; Start-Sleep -Milliseconds 500 }

$fmt = { param($v) ("{0:F4}" -f $v).Replace(',', '.') }
$minLat = & $fmt ($lat - 0.01); $maxLat = & $fmt ($lat + 0.01); $minLon = & $fmt ($lon - 0.01); $maxLon = & $fmt ($lon + 0.01)
$cLat = & $fmt $lat; $cLon = & $fmt $lon
$paths = [ordered]@{
    "map bounds" = "/api/map/bounds?minLat=$minLat&maxLat=$maxLat&minLon=$minLon&maxLon=$maxLon"
    "post bounds" = "/api/posts-read/bounds?minLat=$minLat&maxLat=$maxLat&minLon=$minLon&maxLon=$maxLon"
    "signal detail" = "/api/posts/$postId"
    "nearby posts" = "/api/posts-read/nearby?lat=$cLat&lon=$cLon&radius=2000"
    "Kesfet nearby" = "/api/discover/nearby?lat=$cLat&lon=$cLon&radiusMeters=2000"
    "author list" = "/api/posts-read/author/$($author.Id)?page=1&pageSize=20"
    "hashtag feed" = "/api/discover/hashtag/$tag"
    "feed" = "/api/posts/feed?lat=$cLat&lon=$cLon&radiusMeters=2000"
}
# Where the signal must appear (so "never shows the position" is not trivially true).
$mustList = @("map bounds", "post bounds", "signal detail", "Kesfet nearby", "author list", "hashtag feed")
foreach ($name in $paths.Keys) {
    $r = Invoke-Api -Method GET -Path $paths[$name] -Token $reader.Token
    $leaked = @($exact | Where-Object { $r.Raw.Contains($_) -or $r.Raw.Contains($_.Substring(0, $_.Length - 1)) })
    $found = $r.Raw.Contains($postId)
    Check "$name never shows the exact position" ($leaked.Count -eq 0) "HTTP $($r.Status) leaked=$($leaked -join ',')"
    if ($mustList -contains $name) { Check "$name lists the signal" ($r.Status -eq 200 -and $found) "HTTP $($r.Status)" }
}

if ($script:failures.Count -gt 0) { Write-Host "BLK-LOCPRIV-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-LOCPRIV-01 PASS"
