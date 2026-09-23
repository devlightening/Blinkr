param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-DISCOVER-01 (sinyal-mvp-plan Faz 7): "Yakınımda" lists live nearby signals with coarse distances, never names
# the author of an anonymous one, leaves out people I blocked and spreads authors out; "Takip" lists only what the
# people I follow shared (never their anonymous signals).

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

function Register-SmokeUser {
    param([string]$Label, [string]$Suffix)
    $userName = "disc_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

# A quiet, unique spot so other test data does not crowd the first page.
$rand = New-Object System.Random
$lat = [math]::Round(38.2 + $rand.NextDouble() * 0.6, 5)
$lon = [math]::Round(34.2 + $rand.NextDouble() * 0.6, 5)

function Post-Signal {
    param($User, [string]$Title, [string]$Disclosure = "LimitedProfile", [double]$DLat = 0)
    $r = Invoke-Api -Method POST -Path "/api/posts" -Token $User.Token -Body @{ title = $Title; content = "Discover smoke $Title"; signalType = "Crowd"; signalValue = "Busy"; latitude = $lat + $DLat; longitude = $lon; accuracyMeters = 20; locationName = "Test"; audienceType = "Public"; identityDisclosure = $Disclosure; locationPrecision = "ApproximateArea" }
    if ($r.Status -ne 201) { throw "post $Title failed: HTTP $($r.Status) $($r.Raw)" }
    return $r.Json.postId
}

Write-Host "BLK-DISCOVER-01 discover feeds via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$viewer = Register-SmokeUser -Label "viewer" -Suffix $suffix
$busy = Register-SmokeUser -Label "busy" -Suffix $suffix
$quiet = Register-SmokeUser -Label "quiet" -Suffix $suffix
$blocked = Register-SmokeUser -Label "blocked" -Suffix $suffix

$b1 = Post-Signal $busy "b1-$suffix"; $b2 = Post-Signal $busy "b2-$suffix"; $b3 = Post-Signal $busy "b3-$suffix"
$anon = Post-Signal $busy "anon-$suffix" "AnonymousMap"
$q1 = Post-Signal $quiet "q1-$suffix" "LimitedProfile" 0.004
$x1 = Post-Signal $blocked "x1-$suffix"
$null = Invoke-Api -Method POST -Path "/api/blocks" -Token $viewer.Token -Body @{ userId = $blocked.Id }
$null = Invoke-Api -Method POST -Path "/api/follows/$($busy.Id)" -Token $viewer.Token

$all = $null
for ($i = 0; $i -lt 30; $i++) {
    $all = Invoke-Api -Method GET -Path "/api/discover/nearby?lat=$lat&lon=$lon&radiusMeters=2000&pageSize=30" -Token $viewer.Token
    if ($all.Status -eq 200 -and @($all.Json.items).Count -ge 5) { break }
    Start-Sleep -Milliseconds 500
}
$items = @($all.Json.items)
$ids = @($items | ForEach-Object { $_.id })
Check "nearby feed answers" ($all.Status -eq 200) "HTTP $($all.Status) $($all.Raw)"
Check "it lists the nearby signals" (($ids -contains $b1) -and ($ids -contains $q1) -and ($ids -contains $anon)) "ids=$($ids -join ',')"
Check "a blocked person's signal is left out" (-not ($ids -contains $x1))
$anonItem = @($items | Where-Object { $_.id -eq $anon })[0]
Check "an anonymous signal carries no author" ($anonItem.anonymous -eq $true -and $null -eq $anonItem.authorId -and $anonItem.authorName -ne $busy.UserName -and -not $all.Raw.Contains("anon-$suffix`",`"content`":`"Discover smoke anon-$suffix`",`"signalType`":`"Crowd`",`"signalValue`":`"Busy`",`"authorId`":`"$($busy.Id)"))
Check "distances are coarse (multiples of 50 m)" (@($items | Where-Object { $_.distanceMeters % 50 -ne 0 }).Count -eq 0)
Check "no raw coordinates in the feed" (-not ($all.Raw -match '"lat"|"latitude"'))

$page1 = Invoke-Api -Method GET -Path "/api/discover/nearby?lat=$lat&lon=$lon&radiusMeters=2000&pageSize=3" -Token $viewer.Token
$busyOnPage = @($page1.Json.items | Where-Object { $_.authorId -eq $busy.Id }).Count
Check "at most two signals from one person on a page" ($busyOnPage -le 2 -and @($page1.Json.items).Count -eq 3 -and $page1.Json.hasMore -eq $true) "busy=$busyOnPage count=$(@($page1.Json.items).Count)"

$following = Invoke-Api -Method GET -Path "/api/discover/following" -Token $viewer.Token
$fids = @($following.Json.items | ForEach-Object { $_.id })
Check "following feed shows the followed person's signals" (($fids -contains $b1) -and ($fids -contains $b2) -and ($fids -contains $b3)) "ids=$($fids -join ',')"
Check "... never their anonymous one, nor others'" (-not ($fids -contains $anon) -and -not ($fids -contains $q1))
$quietFollowing = Invoke-Api -Method GET -Path "/api/discover/following" -Token $quiet.Token
Check "someone who follows nobody gets an empty following feed" ($quietFollowing.Status -eq 200 -and @($quietFollowing.Json.items).Count -eq 0)
$guest = Invoke-Api -Method GET -Path "/api/discover/nearby?lat=$lat&lon=$lon"
Check "feeds need a signed-in user (401)" ($guest.Status -eq 401)
$bad = Invoke-Api -Method GET -Path "/api/discover/nearby?lat=999&lon=$lon" -Token $viewer.Token
Check "a bad location is 400" ($bad.Status -eq 400)

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-DISCOVER-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    exit 1
}
Write-Host "`nPASS BLK-DISCOVER-01 discover feeds"
