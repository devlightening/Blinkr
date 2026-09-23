param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-MODERATION-01 (sinyal-mvp-plan Faz 10 P10.3/P10.4, 11 §4): weighted reports hide a signal everywhere (post read
# model and live place state) until a moderator restores it; only Admins see the queue; every decision is in the audit
# trail; the sanction ladder is enforced (24 h posting limit through the token, suspension at sign-in and refresh)
# and the person is told in the app. Also: deleting a place signal removes it from the place's live state.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress -Depth 5)); $args.ContentType = "application/json; charset=utf-8" }
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
    $userName = "mod_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    [pscustomobject]@{ UserName = $userName; Email = "$userName@blinkr.local"; Token = $r.Json.token; Refresh = $r.Json.refreshToken; Id = $r.Json.userId }
}

function Login($User) { Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $User.Email; password = "BlinkrSmoke!2026" } }

# Polls a GET until the predicate holds, at most ~20 s.
function Wait-Until {
    param([string]$Path, [string]$Token, [scriptblock]$Until)
    $last = $null
    for ($i = 0; $i -lt 40; $i++) {
        $last = Invoke-Api -Method GET -Path $Path -Token $Token
        if (& $Until $last) { return $last }
        Start-Sleep -Milliseconds 500
    }
    return $last
}

Write-Host "BLK-MODERATION-01 reports, auto-hide, admin decisions and sanctions via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$author = Register-SmokeUser -Label "author" -Suffix $suffix
$viewer = Register-SmokeUser -Label "viewer" -Suffix $suffix
$mod = Register-SmokeUser -Label "admin" -Suffix $suffix
$reporters = 1..6 | ForEach-Object { Register-SmokeUser -Label "rep$_" -Suffix $suffix }

& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "make-admin.ps1") -User $mod.Email | Out-Null
Check "make-admin gives the Admin role" ($LASTEXITCODE -eq 0)
$mod.Token = (Login $mod).Json.token

# Only Admins see the queue.
$denied = Invoke-Api -Method GET -Path "/api/admin/reports" -Token $viewer.Token
Check "a normal user cannot open the report queue" ($denied.Status -eq 403) "HTTP $($denied.Status)"
$anon = Invoke-Api -Method GET -Path "/api/admin/reports"
Check "without a token the queue is 401" ($anon.Status -eq 401) "HTTP $($anon.Status)"

# A real catalog place, so the live place state is covered too.
$nearby = Invoke-Api -Method GET -Path "/api/places/nearby?lat=39.9334&lon=32.8597&radiusMeters=1500&limit=100" -Token $viewer.Token
$place = $null
foreach ($candidate in @($nearby.Json)) {
    if ($candidate.externalProvider -ne 'osm') { continue }
    $d = Invoke-Api -Method GET -Path "/api/places/$($candidate.id)" -Token $viewer.Token
    if (@($d.Json.recentSignals).Count -eq 0) { $place = $candidate; break }
}
Check "an unused catalog place is available" ($null -ne $place)
function New-PlacePost([string]$Title) {
    $r = Invoke-Api -Method POST -Path "/api/posts" -Token $author.Token -Body @{ title = $Title; content = "Moderation smoke $suffix"; latitude = $place.latitude; longitude = $place.longitude; accuracyMeters = 20; observationLatitude = $place.latitude; observationLongitude = $place.longitude; observationAccuracyMeters = 20; locationName = "Test"; placeId = $place.id; signalType = "Crowd"; signalValue = "BUSY"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "PlaceCenter" }
    if ($r.Status -ne 201) { throw "post failed: HTTP $($r.Status) $($r.Raw)" }
    return $r.Json.postId
}
$postId = New-PlacePost "Reported signal"
$seen = Wait-Until -Path "/api/posts/$postId" -Token $viewer.Token -Until { param($r) $r.Status -eq 200 }
Check "the new signal is visible" ($seen.Status -eq 200)
$inPlace = Wait-Until -Path "/api/places/$($place.id)" -Token $viewer.Token -Until { param($r) @($r.Json.recentSignals | Where-Object { $_.postId -eq $postId }).Count -gt 0 }
Check "the signal counts in the place's live state" (@($inPlace.Json.recentSignals | Where-Object { $_.postId -eq $postId }).Count -gt 0 -and $inPlace.Json.currentState.activeSignalCount -ge 1)

# New accounts report at half weight: five reports (2.5) do not hide, the sixth (3.0) does.
foreach ($r in $reporters[0..4]) {
    $rep = Invoke-Api -Method POST -Path "/api/reports" -Token $r.Token -Body @{ targetType = "signal"; targetId = $postId; reason = "harassment" }
    if ($rep.Status -ne 200) { Check "report accepted" $false "HTTP $($rep.Status) $($rep.Raw)" }
}
Start-Sleep -Seconds 2
Check "below the threshold the signal stays visible" ((Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $viewer.Token).Status -eq 200)
$sixth = Invoke-Api -Method POST -Path "/api/reports" -Token $reporters[5].Token -Body @{ targetType = "signal"; targetId = $postId; reason = "hate"; note = "nefret" }
Check "the new report reasons are accepted" ($sixth.Status -eq 200) "HTTP $($sixth.Status) $($sixth.Raw)"
$gone = Wait-Until -Path "/api/posts/$postId" -Token $viewer.Token -Until { param($r) $r.Status -eq 404 }
Check "at the threshold the signal is hidden (404)" ($gone.Status -eq 404) "HTTP $($gone.Status)"
$feed = Invoke-Api -Method GET -Path "/api/discover/nearby?lat=$($place.latitude)&lon=$($place.longitude)&radiusMeters=2000&pageSize=30" -Token $viewer.Token
Check "the hidden signal is not in the nearby feed" (@($feed.Json.items | Where-Object { $_.id -eq $postId }).Count -eq 0)
$placeHidden = Wait-Until -Path "/api/places/$($place.id)" -Token $viewer.Token -Until { param($r) @($r.Json.recentSignals | Where-Object { $_.postId -eq $postId }).Count -eq 0 }
Check "the hidden signal leaves the place's signals and live state" (@($placeHidden.Json.recentSignals | Where-Object { $_.postId -eq $postId }).Count -eq 0)
$authorView = Invoke-Api -Method GET -Path "/api/posts-read/author/$($author.Id)?page=1&pageSize=20" -Token $author.Token
Check "the hidden signal is not on the author's profile either" (($authorView.Raw -notmatch $postId))

# The queue: priority (self-harm) first, then by weighted score.
$selfHarmPost = New-PlacePost "Self-harm report"
Wait-Until -Path "/api/posts/$selfHarmPost" -Token $viewer.Token -Until { param($r) $r.Status -eq 200 } | Out-Null
$sh = Invoke-Api -Method POST -Path "/api/reports" -Token $viewer.Token -Body @{ targetType = "signal"; targetId = $selfHarmPost; reason = "self_harm" }
Check "a self-harm report is accepted" ($sh.Status -eq 200)
$queue = Invoke-Api -Method GET -Path "/api/admin/reports" -Token $mod.Token
$row = @($queue.Json.items | Where-Object { $_.targetId -eq $postId })[0]
Check "the admin queue shows the hidden signal with its score" ($queue.Status -eq 200 -and $row.score -eq 3 -and $row.reports -eq 6 -and $row.signalState -eq "hidden") "HTTP $($queue.Status) row=$($row | ConvertTo-Json -Compress -Depth 3)"
Check "self-harm reports come first" ($queue.Json.items[0].priority -eq $true -and $queue.Json.items[0].targetId -eq $selfHarmPost)

# Restore brings it back everywhere; the audit trail has both decisions.
$restore = Invoke-Api -Method POST -Path "/api/admin/reports/resolve" -Token $mod.Token -Body @{ targetType = "signal"; targetId = $postId; action = "restore"; note = "yanlış alarm" }
Check "a moderator can restore" ($restore.Status -eq 200) "HTTP $($restore.Status) $($restore.Raw)"
$back = Wait-Until -Path "/api/posts/$postId" -Token $viewer.Token -Until { param($r) $r.Status -eq 200 }
Check "the restored signal is visible again" ($back.Status -eq 200)
$placeBack = Wait-Until -Path "/api/places/$($place.id)" -Token $viewer.Token -Until { param($r) @($r.Json.recentSignals | Where-Object { $_.postId -eq $postId }).Count -gt 0 }
Check "the restored signal counts in the place again" (@($placeBack.Json.recentSignals | Where-Object { $_.postId -eq $postId }).Count -gt 0)
$trail = Invoke-Api -Method GET -Path "/api/admin/actions?targetId=$postId" -Token $mod.Token
$actions = @($trail.Json.items | ForEach-Object { $_.action })
Check "the audit trail has the automatic hide and the restore" ($actions -contains "auto_hide" -and $actions -contains "restore" -and @($trail.Json.items | Where-Object { $_.action -eq "auto_hide" -and $_.automatic }).Count -eq 1)
$queueAfter = Invoke-Api -Method GET -Path "/api/admin/reports" -Token $mod.Token
Check "resolved reports leave the queue" (@($queueAfter.Json.items | Where-Object { $_.targetId -eq $postId }).Count -eq 0)
$remove = Invoke-Api -Method POST -Path "/api/admin/reports/resolve" -Token $mod.Token -Body @{ targetType = "signal"; targetId = $selfHarmPost; action = "remove" }
$removed = Wait-Until -Path "/api/posts/$selfHarmPost" -Token $viewer.Token -Until { param($r) $r.Status -eq 404 }
Check "a moderator can remove a signal" ($remove.Status -eq 200 -and $removed.Status -eq 404)
$bad = Invoke-Api -Method POST -Path "/api/admin/reports/resolve" -Token $mod.Token -Body @{ targetType = "signal"; targetId = $postId; action = "ban" }
Check "user sanctions are not valid on a signal" ($bad.Status -eq 400)
$notAdmin = Invoke-Api -Method POST -Path "/api/admin/reports/resolve" -Token $viewer.Token -Body @{ targetType = "signal"; targetId = $postId; action = "hide" }
Check "a normal user cannot decide" ($notAdmin.Status -eq 403)

# Deleting a place signal removes it from the place's live state (was left until it expired).
$delete = Invoke-Api -Method DELETE -Path "/api/posts/$postId" -Token $author.Token
$placeAfterDelete = Wait-Until -Path "/api/places/$($place.id)" -Token $viewer.Token -Until { param($r) @($r.Json.recentSignals | Where-Object { $_.postId -eq $postId }).Count -eq 0 }
Check "a deleted signal leaves the place's live state" ($delete.Status -eq 204 -and @($placeAfterDelete.Json.recentSignals | Where-Object { $_.postId -eq $postId }).Count -eq 0) "HTTP $($delete.Status)"

# Sanctions: 24 h posting limit (through the next token), and the person is told.
$restrict = Invoke-Api -Method POST -Path "/api/admin/reports/resolve" -Token $mod.Token -Body @{ targetType = "user"; targetId = $author.Id; action = "restrict_24h"; note = "spam" }
Check "a moderator can limit posting for 24 h" ($restrict.Status -eq 200) "HTTP $($restrict.Status) $($restrict.Raw)"
$authorToken = (Login $author).Json.token
$blocked = Invoke-Api -Method POST -Path "/api/posts" -Token $authorToken -Body @{ title = "x"; content = "Kısıtlı iken"; latitude = 37.07; longitude = 36.24; accuracyMeters = 20; locationName = "Test"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea" }
Check "a restricted person cannot post" ($blocked.Status -eq 403 -and $blocked.Json.code -eq "POSTING_RESTRICTED") "HTTP $($blocked.Status) $($blocked.Raw)"
$comment = Invoke-Api -Method POST -Path "/api/posts/$selfHarmPost/comments" -Token $authorToken -Body @{ commentText = "yorum" }
Check "a restricted person cannot comment" ($comment.Status -eq 403)
$notice = Wait-Until -Path "/api/notifications?pageSize=20" -Token $authorToken -Until { param($r) @($r.Json.items | Where-Object { $_.type -eq "ModerationNotice" }).Count -gt 0 }
Check "the person is told about the sanction" (@($notice.Json.items | Where-Object { $_.type -eq "ModerationNotice" }).Count -gt 0)

# Suspension: sign-in and refresh refused.
$target = $reporters[0]
$suspend = Invoke-Api -Method POST -Path "/api/admin/reports/resolve" -Token $mod.Token -Body @{ targetType = "user"; targetId = $target.Id; action = "suspend_7d" }
Check "a moderator can suspend" ($suspend.Status -eq 200)
$login = Login $target
Check "a suspended person cannot sign in" ($login.Status -eq 403 -and $login.Json.code -eq "ACCOUNT_SUSPENDED" -and $login.Json.until) "HTTP $($login.Status) $($login.Raw)"
$refresh = Invoke-Api -Method POST -Path "/api/auth/refresh" -Body @{ refreshToken = $target.Refresh }
Check "a suspended person's session cannot be refreshed" ($refresh.Status -eq 401) "HTTP $($refresh.Status)"
$self = Invoke-Api -Method POST -Path "/api/admin/reports/resolve" -Token $mod.Token -Body @{ targetType = "user"; targetId = $mod.Id; action = "ban" }
Check "a moderator cannot sanction themselves" ($self.Status -eq 400)

if ($script:failures.Count -gt 0) {
    Write-Host "BLK-MODERATION-01 FAILED: $($script:failures -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "BLK-MODERATION-01 PASS"
