param(
    [string]$GatewayBaseUrl = "http://localhost:5080",
    # A city with an imported OSM catalog (default: Ankara Kizilay, same as test-place-live-signal.ps1).
    [double]$Lat = 39.9334,
    [double]$Lon = 32.8597,
    [int]$WaitSeconds = 60
)

# BLK-NICHE-01: end-to-end proof for the features built on 2026-10-03 without a running backend:
#   D-033 chat pin/mute, D-034 place card in chat, D-035 meetup, D-036 verified line on profiles,
#   D-037 place rhythm, D-038 "Haber ver" (PlaceService event -> NotificationsService), D-039 "Yere sor",
#   D-040 place attributes, D-041 collections.
# Needs the full stack (start-blinkr-dev.ps1) incl. RabbitMQ, the projection worker and a real place catalog.
# ASCII only on purpose: Windows PowerShell 5 reads a BOM-less script as ANSI.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Compress -Depth 6); $args.ContentType = "application/json; charset=utf-8" }
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

function Register-User {
    param([string]$Label, [string]$Suffix)
    $userName = "e2e_niche_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if (-not $r.Json.token) { throw "Register failed for ${userName}: HTTP $($r.Status) $($r.Raw)" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

# A verified-on-site signal: observation exactly at the place, 20 m accuracy -> the server publishes VERIFIED_LIVE.
function Publish-Signal {
    param($User, $Place, [string]$Type, [string]$Value, [string]$Disclosure = "LimitedProfile")
    $r = Invoke-Api -Method POST -Path "/api/posts" -Token $User.Token -Body @{
        title = "niche e2e"; content = "niche e2e $Type $Value"
        latitude = $Place.latitude; longitude = $Place.longitude; accuracyMeters = 20
        observationLatitude = $Place.latitude; observationLongitude = $Place.longitude; observationAccuracyMeters = 20
        locationName = $Place.name; placeId = $Place.id
        signalType = $Type; signalValue = $Value
        audienceType = "Public"; identityDisclosure = $Disclosure; locationPrecision = "PlaceCenter"
    }
    $id = $r.Json.postId; if (-not $id) { $id = $r.Json.PostId }
    if (-not $id) { throw "Post failed for $($User.UserName): HTTP $($r.Status) $($r.Raw)" }
    return $id
}

function Wait-Until {
    param([scriptblock]$Probe, [int]$Seconds = $WaitSeconds)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        $value = & $Probe
        if ($value) { return $value }
        Start-Sleep -Seconds 2
    }
    return $null
}

function Find-Notification {
    param($User, [string]$Type, [string]$PostId)
    Wait-Until {
        $n = Invoke-Api -Method GET -Path "/api/notifications?pageSize=50" -Token $User.Token
        @($n.Json.items | Where-Object { $_.type -eq $Type -and (-not $PostId -or $_.postId -eq $PostId) })[0]
    }
}

function Count-Notifications {
    param($User, [string]$Type)
    $n = Invoke-Api -Method GET -Path "/api/notifications?pageSize=50" -Token $User.Token
    @($n.Json.items | Where-Object { $_.type -eq $Type }).Count
}

Write-Host "BLK-NICHE-01 niche features via $GatewayBaseUrl" -ForegroundColor Cyan
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$a = Register-User -Label "a" -Suffix $suffix
$b = Register-User -Label "b" -Suffix $suffix
$c = Register-User -Label "c" -Suffix $suffix
$d = Register-User -Label "d" -Suffix $suffix
$e = Register-User -Label "e" -Suffix $suffix

# Catalog places with no live activity, so every state change below is caused by this run.
$nearby = Invoke-Api -Method GET -Path "/api/places/nearby?lat=$Lat&lon=$Lon&radiusMeters=1500&limit=100"
$fresh = New-Object System.Collections.Generic.List[object]
foreach ($candidate in @($nearby.Json)) {
    if ($fresh.Count -ge 9) { break }
    $detail = Invoke-Api -Method GET -Path "/api/places/$($candidate.id)"
    if (@($detail.Json.recentSignals).Count -eq 0 -and -not $detail.Json.currentState.signalType) { $fresh.Add($candidate) }
}
if ($fresh.Count -lt 9) { throw "Need 9 quiet catalog places near $Lat,$Lon (found $($fresh.Count)). Import the catalog or pass -Lat/-Lon." }
# The rhythm checks need a place with no 8-week history either; "quiet now" is not enough after earlier runs.
$unseen = @($fresh | Where-Object { (Invoke-Api -Method GET -Path "/api/places/$($_.id)/rhythm").Json.observations -eq 0 })[0]
if (-not $unseen) {
    foreach ($candidate in @($nearby.Json)) {
        if ($fresh.Contains($candidate)) { continue }
        $detail = Invoke-Api -Method GET -Path "/api/places/$($candidate.id)"
        if (@($detail.Json.recentSignals).Count -ne 0 -or $detail.Json.currentState.signalType) { continue }
        if ((Invoke-Api -Method GET -Path "/api/places/$($candidate.id)/rhythm").Json.observations -eq 0) { $unseen = $candidate; $fresh[8] = $candidate; break }
    }
}
if (-not $unseen) { throw "No catalog place near $Lat,$Lon without rhythm history. Pass other -Lat/-Lon." }
[void]$fresh.Remove($unseen); $fresh.Insert(0, $unseen)
$place = $fresh[0]; $placeQ = $fresh[1]; $extra = @($fresh[2..8])
Write-Host "Using places $($place.id) and $($placeQ.id)"

# ---------------------------------------------------------------- D-033 chat pin / mute
$convB = (Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $b.Id }).Json.id
$convC = (Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $c.Id }).Json.id
$convD = (Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $d.Id }).Json.id
$convE = (Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $e.Id }).Json.id
$pin = Invoke-Api -Method PUT -Path "/api/chat/conversations/$convB/preferences" -Token $a.Token -Body @{ pinned = $true }
Check "D-033 pin a conversation" ($pin.Status -eq 200 -and $pin.Json.isPinned) "HTTP $($pin.Status) $($pin.Raw)"
$mute = Invoke-Api -Method PUT -Path "/api/chat/conversations/$convB/preferences" -Token $a.Token -Body @{ muted = $true }
Check "D-033 mute keeps the pin (null = unchanged)" ($mute.Json.isMuted -and $mute.Json.isPinned)
$listA = Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $a.Token
$rowB = @($listA.Json.items | Where-Object { $_.id -eq $convB })[0]
Check "D-033 the list carries isPinned / isMuted" ($rowB.isPinned -and $rowB.isMuted)
$listB = Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $b.Token
$rowBforB = @($listB.Json.items | Where-Object { $_.id -eq $convB })[0]
Check "D-033 the other person never sees my pin or mute" (-not $rowBforB.isPinned -and -not $rowBforB.isMuted)
[void](Invoke-Api -Method PUT -Path "/api/chat/conversations/$convC/preferences" -Token $a.Token -Body @{ pinned = $true })
[void](Invoke-Api -Method PUT -Path "/api/chat/conversations/$convD/preferences" -Token $a.Token -Body @{ pinned = $true })
$fourth = Invoke-Api -Method PUT -Path "/api/chat/conversations/$convE/preferences" -Token $a.Token -Body @{ pinned = $true }
Check "D-033 a fourth pin is refused (409 PIN_LIMIT)" ($fourth.Status -eq 409 -and $fourth.Raw -match "PIN_LIMIT") "HTTP $($fourth.Status) $($fourth.Raw)"
$empty = Invoke-Api -Method PUT -Path "/api/chat/conversations/$convB/preferences" -Token $a.Token -Body @{}
Check "D-033 nothing to change is 400" ($empty.Status -eq 400)
$stranger = Invoke-Api -Method PUT -Path "/api/chat/conversations/$convB/preferences" -Token $c.Token -Body @{ pinned = $true }
Check "D-033 someone outside the conversation gets 403" ($stranger.Status -eq 403)

# ---------------------------------------------------------------- D-034 place card, D-035 meetup
$msgPath = "/api/chat/conversations/$convB/messages"
$placeMsg = Invoke-Api -Method POST -Path $msgPath -Token $a.Token -Body @{ text = ""; place = @{ placeId = $place.id; name = $place.name; category = $place.category } }
Check "D-034 a place can be shared" ($placeMsg.Status -eq 200 -and $placeMsg.Json.kind -eq "place" -and $placeMsg.Json.place.placeId -eq $place.id) "HTTP $($placeMsg.Status) $($placeMsg.Raw)"
Check "D-034 the place message has no coordinates" (-not ($placeMsg.Raw -match '"latitude"|"longitude"'))
$both = Invoke-Api -Method POST -Path $msgPath -Token $a.Token -Body @{ text = ""; place = @{ placeId = $place.id; name = $place.name }; signal = @{ postId = "$([guid]::NewGuid())"; signalType = "Crowd" } }
Check "D-034 a message shares one thing (400)" ($both.Status -eq 400)
$at = (Get-Date).ToUniversalTime().AddHours(2).ToString("o")
$meet = Invoke-Api -Method POST -Path $msgPath -Token $a.Token -Body @{ text = ""; place = @{ placeId = $place.id; name = $place.name }; meetup = @{ atUtc = $at } }
Check "D-035 a meetup can be proposed" ($meet.Status -eq 200 -and $meet.Json.kind -eq "meetup" -and $meet.Json.meetup.atUtc) "HTTP $($meet.Status) $($meet.Raw)"
$far = Invoke-Api -Method POST -Path $msgPath -Token $a.Token -Body @{ text = ""; place = @{ placeId = $place.id; name = $place.name }; meetup = @{ atUtc = (Get-Date).ToUniversalTime().AddDays(20).ToString("o") } }
Check "D-035 more than 14 days ahead is refused (400)" ($far.Status -eq 400)
$going = Invoke-Api -Method PUT -Path "$msgPath/$($meet.Json.id)/meetup" -Token $b.Token -Body @{ answer = "going" }
Check "D-035 the other person answers going" ($going.Status -eq 200 -and @($going.Json.meetup.responses | Where-Object { $_.userId -eq $b.Id -and $_.answer -eq "going" }).Count -eq 1) "HTTP $($going.Status) $($going.Raw)"
$own = Invoke-Api -Method PUT -Path "$msgPath/$($meet.Json.id)/meetup" -Token $a.Token -Body @{ answer = "going" }
Check "D-035 the proposer cannot answer their own (403)" ($own.Status -eq 403)
$back = Invoke-Api -Method PUT -Path "$msgPath/$($meet.Json.id)/meetup" -Token $b.Token -Body @{ answer = $null }
Check "D-035 an answer can be taken back" (@($back.Json.meetup.responses).Count -eq 0)

# ---------------------------------------------------------------- D-038 watch (set before any signal at the place)
$watchB = Invoke-Api -Method PUT -Path "/api/place-watches/$($place.id)" -Token $b.Token -Body @{ condition = "update"; placeName = $place.name }
Check "D-038 B watches the place" ($watchB.Status -eq 200 -and $watchB.Json.condition -eq "update") "HTTP $($watchB.Status) $($watchB.Raw)"
[void](Invoke-Api -Method PUT -Path "/api/place-watches/$($place.id)" -Token $a.Token -Body @{ condition = "update"; placeName = $place.name })
$i = 0; $lastWatch = $null
foreach ($p in $extra[0..4]) { $lastWatch = Invoke-Api -Method PUT -Path "/api/place-watches/$($p.id)" -Token $c.Token -Body @{ condition = "calm"; placeName = $p.name }; $i++ }
$sixth = Invoke-Api -Method PUT -Path "/api/place-watches/$($extra[5].id)" -Token $c.Token -Body @{ condition = "calm"; placeName = $extra[5].name }
Check "D-038 a sixth watch is refused (409 WATCH_LIMIT)" ($sixth.Status -eq 409 -and $sixth.Raw -match "WATCH_LIMIT") "HTTP $($sixth.Status) $($sixth.Raw)"

# ---------------------------------------------------------------- D-039 ask before the answer
$askC = Invoke-Api -Method POST -Path "/api/places/$($placeQ.id)/questions" -Token $c.Token -Body @{ kind = "crowd" }
$askD = Invoke-Api -Method POST -Path "/api/places/$($placeQ.id)/questions" -Token $d.Token -Body @{ kind = "crowd" }
Check "D-039 a second asker joins the open question" ($askD.Status -eq 200 -and $askD.Json.id -eq $askC.Json.id -and $askD.Json.waiting -eq 2) "C=$($askC.Raw) D=$($askD.Raw)"
$qPublic = Invoke-Api -Method GET -Path "/api/places/$($placeQ.id)/questions"
Check "D-039 questions never carry who asked" (-not ($qPublic.Raw -match "askerIds|$($c.Id)|$($d.Id)"))
$qMine = Invoke-Api -Method GET -Path "/api/places/$($placeQ.id)/questions" -Token $c.Token
Check "D-039 askedByMe only for the asker" (@($qMine.Json | Where-Object { $_.askedByMe }).Count -eq 1)
[void](Invoke-Api -Method POST -Path "/api/places/$($extra[0].id)/questions" -Token $c.Token -Body @{ kind = "queue" })
[void](Invoke-Api -Method POST -Path "/api/places/$($extra[1].id)/questions" -Token $c.Token -Body @{ kind = "queue" })
$fourthQ = Invoke-Api -Method POST -Path "/api/places/$($extra[2].id)/questions" -Token $c.Token -Body @{ kind = "queue" }
Check "D-039 a fourth open question is refused (409 QUESTION_LIMIT)" ($fourthQ.Status -eq 409 -and $fourthQ.Raw -match "QUESTION_LIMIT") "HTTP $($fourthQ.Status) $($fourthQ.Raw)"
$badKind = Invoke-Api -Method POST -Path "/api/places/$($placeQ.id)/questions" -Token $c.Token -Body @{ kind = "anything" }
Check "D-039 only the three fixed questions (400)" ($badKind.Status -eq 400)

# ---------------------------------------------------------------- signals (verified on site)
# A first, alone: its signal turns the empty place's live state into "Crowd: Busy".
$postA = Publish-Signal -User $a -Place $place -Type "Crowd" -Value "Busy"

# D-038: B is told; A (whose own signal caused it) is not and keeps the watch.
$noticeB = Find-Notification -User $b -Type "PlaceWatch"
Check "D-038 the watcher is told when the place's state changes" ($null -ne $noticeB) "no PlaceWatch notice for B within $WaitSeconds s"
Check "D-038 the notice opens the verified signal that changed it" ($noticeB -and $noticeB.postId -eq $postA) "postId=$($noticeB.postId)"
$watchesB = Invoke-Api -Method GET -Path "/api/place-watches" -Token $b.Token
Check "D-038 the watch ends after firing" (@($watchesB.Json | Where-Object { $_.placeId -eq $place.id }).Count -eq 0)
$watchesA = Invoke-Api -Method GET -Path "/api/place-watches" -Token $a.Token
Check "D-038 no notice for a change your own signal caused (watch kept)" ((Count-Notifications -User $a -Type "PlaceWatch") -eq 0 -and @($watchesA.Json | Where-Object { $_.placeId -eq $place.id }).Count -eq 1)

# Two more people agree (one sends the legacy upper-case value): the visible state stays "Busy", so no new event.
$postB = Publish-Signal -User $b -Place $place -Type "Crowd" -Value "Busy"
$postC = Publish-Signal -User $c -Place $place -Type "Crowd" -Value "BUSY"
$anonA = Publish-Signal -User $a -Place $extra[6] -Type "Crowd" -Value "Calm" -Disclosure "AnonymousMap"
$answer = Publish-Signal -User $e -Place $placeQ -Type "Crowd" -Value "Calm"
Start-Sleep -Seconds 6
Check "D-038 told once, not per signal" ((Count-Notifications -User $b -Type "PlaceWatch") -eq 1)
Check "D-038 agreeing signals do not wake other watchers" ((Count-Notifications -User $a -Type "PlaceWatch") -eq 0)

# D-039: E's verified answer reaches C and D, not E.
$noticeC = Find-Notification -User $c -Type "PlaceQuestionAnswered" -PostId $answer
$noticeD = Find-Notification -User $d -Type "PlaceQuestionAnswered" -PostId $answer
Check "D-039 every asker is told" ($null -ne $noticeC -and $null -ne $noticeD) "C=$($null -ne $noticeC) D=$($null -ne $noticeD)"
Check "D-039 the notice does not name who answered" (-not (($noticeC | ConvertTo-Json -Depth 5) -match $e.UserName))
Check "D-039 the answerer is not notified" ((Count-Notifications -User $e -Type "PlaceQuestionAnswered") -eq 0)
$answered = Invoke-Api -Method GET -Path "/api/places/$($placeQ.id)/questions" -Token $c.Token
Check "D-039 the question shows the answer" (@($answered.Json | Where-Object { $_.status -eq "answered" -and $_.answerPostId -eq $answer }).Count -eq 1) $answered.Raw

# ---------------------------------------------------------------- D-036 verified line
$trust = Wait-Until { $t = Invoke-Api -Method GET -Path "/api/posts-read/author/$($a.Id)/trust" -Token $b.Token; if ($t.Json.verifiedSignals -ge 1) { $t } }
Check "D-036 verified signals are counted" ($null -ne $trust -and $trust.Json.verifiedSignals -eq 1 -and $trust.Json.verifiedPlaces -eq 1) "$($trust.Raw)"
$own = Invoke-Api -Method GET -Path "/api/posts-read/author/$($a.Id)/trust" -Token $a.Token
Check "D-036 the anonymous signal never counts, even for its author" ($own.Json.verifiedSignals -eq 1) $own.Raw
Check "D-036 no place names in the answer" (-not ($own.Raw -match [regex]::Escape($place.name)))

# ---------------------------------------------------------------- D-037 rhythm
$rhythm = Wait-Until { $r = Invoke-Api -Method GET -Path "/api/places/$($place.id)/rhythm"; if ($r.Json.observations -ge 3) { $r } }
Check "D-037 the rhythm counts one voice per person and hour" ($null -ne $rhythm -and $rhythm.Json.observations -eq 3) "$($rhythm.Raw)"
Check "D-037 fewer than 8 observations: no rhythm yet" ($rhythm -and -not $rhythm.Json.enough -and @($rhythm.Json.days).Count -eq 0)
Check "D-037 nobody is identifiable in the rhythm" ($rhythm -and -not ($rhythm.Raw -match "$($a.Id)|$($b.Id)|$($c.Id)"))

# ---------------------------------------------------------------- D-040 attributes
$voteA = Invoke-Api -Method PUT -Path "/api/places/$($place.id)/attributes/wifi" -Token $a.Token -Body @{ value = $true }
Check "D-040 a verified visitor can answer" ($voteA.Status -eq 200 -and @($voteA.Json.attributes | Where-Object { $_.key -eq "wifi" -and $_.state -eq "yes" -and $_.myVote -eq $true }).Count -eq 1) "HTTP $($voteA.Status) $($voteA.Raw)"
$voteD = Invoke-Api -Method PUT -Path "/api/places/$($place.id)/attributes/wifi" -Token $d.Token -Body @{ value = $false }
Check "D-040 someone not verified here is refused (403)" ($voteD.Status -eq 403 -and $voteD.Raw -match "ATTRIBUTE_NOT_ELIGIBLE") "HTTP $($voteD.Status) $($voteD.Raw)"
$attrsAnon = Invoke-Api -Method GET -Path "/api/places/$($place.id)/attributes"
Check "D-040 voters are never returned" (-not ($attrsAnon.Raw -match "$($a.Id)|userId") -and -not $attrsAnon.Json.canVote)
$badKey = Invoke-Api -Method PUT -Path "/api/places/$($place.id)/attributes/tasty" -Token $a.Token -Body @{ value = $true }
Check "D-040 only catalog facts (400)" ($badKey.Status -eq 400)
$undo = Invoke-Api -Method PUT -Path "/api/places/$($place.id)/attributes/wifi" -Token $a.Token -Body @{ value = $null }
Check "D-040 an answer can be taken back" (@($undo.Json.attributes | Where-Object { $_.key -eq "wifi" }).Count -eq 0)

# ---------------------------------------------------------------- D-041 collections
$list = Invoke-Api -Method POST -Path "/api/users/me/collections" -Token $a.Token -Body @{ title = "Ders calismalik kafeler" }
Check "D-041 a collection is created private" ($list.Status -eq 200 -and $list.Json.visibility -eq "private" -and -not $list.Json.shareToken) "HTTP $($list.Status) $($list.Raw)"
$cid = $list.Json.id
$withPlace = Invoke-Api -Method PUT -Path "/api/users/me/collections/$cid/items/$($place.id)" -Token $a.Token -Body @{ name = $place.name; category = $place.category; latitude = $place.latitude; longitude = $place.longitude; note = "sessiz kose" }
Check "D-041 a place is added with a note" ($withPlace.Status -eq 200 -and @($withPlace.Json.items).Count -eq 1 -and $withPlace.Json.items[0].note -eq "sessiz kose") "HTTP $($withPlace.Status) $($withPlace.Raw)"
$again = Invoke-Api -Method PUT -Path "/api/users/me/collections/$cid/items/$($place.id)" -Token $a.Token -Body @{ name = $place.name; latitude = $place.latitude; longitude = $place.longitude }
Check "D-041 adding the same place twice keeps one row" (@($again.Json.items).Count -eq 1)
$summary = Invoke-Api -Method GET -Path "/api/users/me/collections" -Token $a.Token
Check "D-041 the summary lists its place ids" (@($summary.Json | Where-Object { $_.id -eq $cid })[0].placeIds -contains $place.id)
$foreign = Invoke-Api -Method GET -Path "/api/users/me/collections/$cid" -Token $b.Token
Check "D-041 someone else cannot open my list by id (404)" ($foreign.Status -eq 404)
$shared = Invoke-Api -Method PUT -Path "/api/users/me/collections/$cid" -Token $a.Token -Body @{ visibility = "link" }
$token = $shared.Json.shareToken
Check "D-041 sharing by link issues a 22-character token" ($shared.Status -eq 200 -and $token -and $token.Length -eq 22) "HTTP $($shared.Status) $($shared.Raw)"
$viewB = Invoke-Api -Method GET -Path "/api/collections/shared/$token" -Token $b.Token
Check "D-041 anyone signed in with the link can read it" ($viewB.Status -eq 200 -and -not $viewB.Json.isMine -and $viewB.Json.owner.userName -eq $a.UserName -and -not $viewB.Json.shareToken) "HTTP $($viewB.Status) $($viewB.Raw)"
$rotated = Invoke-Api -Method PUT -Path "/api/users/me/collections/$cid" -Token $a.Token -Body @{ newLink = $true }
$old = Invoke-Api -Method GET -Path "/api/collections/shared/$token" -Token $b.Token
Check "D-041 a new link cuts the old one off (404)" ($rotated.Json.shareToken -ne $token -and $old.Status -eq 404)
[void](Invoke-Api -Method POST -Path "/api/blocks" -Token $a.Token -Body @{ userId = $d.Id })
$blockedView = Invoke-Api -Method GET -Path "/api/collections/shared/$($rotated.Json.shareToken)" -Token $d.Token
Check "D-041 a blocked person gets 404 (the block is not revealed)" ($blockedView.Status -eq 404)
[void](Invoke-Api -Method PUT -Path "/api/users/me/collections/$cid" -Token $a.Token -Body @{ visibility = "private" })
$privateView = Invoke-Api -Method GET -Path "/api/collections/shared/$($rotated.Json.shareToken)" -Token $b.Token
Check "D-041 back to private: the link stops working" ($privateView.Status -eq 404)
$anon = Invoke-Api -Method GET -Path "/api/collections/shared/$($rotated.Json.shareToken)"
Check "D-041 reading a shared list needs sign-in" ($anon.Status -eq 401)
$empty = Invoke-Api -Method POST -Path "/api/users/me/collections" -Token $a.Token -Body @{ title = "   " }
Check "D-041 a title is required (400)" ($empty.Status -eq 400)
$gone = Invoke-Api -Method DELETE -Path "/api/users/me/collections/$cid" -Token $a.Token
Check "D-041 the owner deletes the list" ($gone.Status -eq 204 -and (Invoke-Api -Method GET -Path "/api/users/me/collections/$cid" -Token $a.Token).Status -eq 404)

Write-Host ""
if ($script:failures.Count -gt 0) {
    Write-Host "BLK-NICHE-01 FAIL ($($script:failures.Count)): $($script:failures -join '; ')" -ForegroundColor Red
    exit 1
}
Write-Host "BLK-NICHE-01 PASS" -ForegroundColor Green
