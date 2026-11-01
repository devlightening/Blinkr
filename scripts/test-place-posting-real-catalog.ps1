param([string]$GatewayBaseUrl = 'http://localhost:5080', [switch]$Stress)
$ErrorActionPreference = 'Stop'
$culture = [Globalization.CultureInfo]::InvariantCulture
function Assert($value, $message) { if (-not $value) { throw $message }; Write-Host "PASS $message" }
function Json($method, $path, $body = $null) {
    $args = @{ Uri = "$GatewayBaseUrl$path"; Method = $method; TimeoutSec = 30; Headers = $script:headers }
    if ($null -ne $body) {
        $args.ContentType = 'application/json; charset=utf-8'
        $args.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 8))
    }
    try { Invoke-RestMethod @args }
    catch {
        $detail = $_.ErrorDetails.Message
        if (-not $detail -and $_.Exception.Response) {
            $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
            try { $detail = $reader.ReadToEnd() } finally { $reader.Dispose() }
        }
        if ($detail) { Write-Host "$method $path rejected: $detail" }
        throw
    }
}
$headers = @{}
Json GET '/health' | Out-Null
$name = 'e2e_product_' + [guid]::NewGuid().ToString('N').Substring(0,12)
$auth = Json POST '/api/auth/register' @{ userName=$name; email="$name@blinkr.local"; password='BlinkrSmoke!2026' }
$headers = @{ Authorization = "Bearer $($auth.token)" }
$candidates = Json GET '/api/places/nearby?lat=39.9334&lon=32.8597&radiusMeters=1500&limit=100'
$place = $null
foreach ($candidate in $candidates) {
    if ($candidate.externalProvider -ne 'osm') { continue }
    $detail = Json GET "/api/places/$($candidate.id)"
    if (-not $detail.geometryWkt -and @($detail.recentSignals).Count -eq 0) { $place = $detail; break }
}
Assert ($null -ne $place) 'Existing real point Place selected; no catalog records created'
function Presence($metres, $accuracy=0) {
    Json POST '/api/posts/place-presence' @{ placeId=$place.id; latitude=([double]$place.latitude + $metres/6371000*180/[Math]::PI); longitude=$place.longitude; accuracyMeters=$accuracy }
}
Assert ((Presence 100).trustLevel -eq 'VERIFIED_LIVE') '100m server verified'
Assert ((Presence 350).trustLevel -eq 'NEARBY_PLACE_POST') '350m server nearby'
Assert (-not (Presence 900).isAllowed) '900m publication denied'
Assert (-not (Presence 100 2000).isAllowed) '2000m accuracy denied'
function Publish($metres, $value) {
    Json POST '/api/posts' @{
        title="Product policy $value"; content='Real catalog acceptance test'; placeId=$place.id
        latitude=$place.latitude; longitude=$place.longitude; accuracyMeters=1; locationName=[string]$place.name
        observationLatitude=([double]$place.latitude + $metres/6371000*180/[Math]::PI)
        observationLongitude=$place.longitude; observationAccuracyMeters=0
        signalType='Crowd'; signalValue=$value; audienceType='Public'; identityDisclosure='LimitedProfile'
        locationPrecision='PlaceCenter'; expiresAt=[DateTime]::UtcNow.AddMinutes(15).ToString('o')
        proximityAllowed=$true; proximityDistanceMeters=0; publicationTrust='VERIFIED_LIVE'
    }
}
function WaitPost($id) {
    for ($i=0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 1
        $detail = Json GET "/api/places/$($place.id)"
        if ($detail.recentSignals | Where-Object postId -eq $id) { return $detail }
    }
    throw "Projection missing PostId=$id"
}
$near = Publish 350 'Busy'
$detail = WaitPost $near.postId
$signal = $detail.recentSignals | Where-Object postId -eq $near.postId
Assert ($signal.publicationTrust -eq 'NEARBY_PLACE_POST') 'Client spoof ignored; nearby trust persisted through event projection'
Assert ($detail.currentState.activeSignalCount -eq 0) 'Nearby content does not alter trusted state'
$lat=[double]$place.latitude; $lon=[double]$place.longitude
$bounds='/api/map/bounds?south='+($lat-.02).ToString($culture)+'&north='+($lat+.02).ToString($culture)+'&west='+($lon-.02).ToString($culture)+'&east='+($lon+.02).ToString($culture)
$map=Json GET $bounds
Assert (@($map.places | Where-Object id -eq $place.id).Count -eq 1) 'Nearby content activates one Place marker'
$verified=Publish 100 'Calm'
$detail=WaitPost $verified.postId
Assert ($detail.currentState.activeSignalCount -eq 1 -and $detail.currentState.signalValue -eq 'Calm') 'Verified content alone determines live state'
try { Publish 900 'Busy' | Out-Null; throw 'Out-of-range write unexpectedly accepted.' }
catch { Assert ($null -ne $_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 422) 'Authoritative write rejects 900m despite spoofed client trust' }
if ($Stress) {
    for ($i=0; $i -lt 21; $i++) { $latest=Publish 350 'Busy'; Start-Sleep -Milliseconds 400 }
    $detail=WaitPost $latest.postId
    Assert ($detail.currentState.activeSignalCount -eq 1 -and $detail.currentState.signalValue -eq 'Calm') '21 newer nearby posts cannot evict verified state at query limit'
}
$query=[Uri]::EscapeDataString($place.name)
$search=Json GET ('/api/places/search?q='+$query+'&lat='+$lat.ToString($culture)+'&lon='+$lon.ToString($culture))
Assert (@($search | Where-Object id -eq $place.id).Count -eq 1) 'Local name search preserves exact PlaceId'
Write-Host "PlaceId=$($place.id) NearbyPostId=$($near.postId) VerifiedPostId=$($verified.postId)"
Write-Host 'PASS REAL_CATALOG_API_ONLY; physical GPS and iPhone touch not tested'
