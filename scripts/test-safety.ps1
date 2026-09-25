param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-SAFETY-01: blocking and reporting. A block ends the friendship, hides both people from each other in search and
# profiles, stops friend requests, and stops chat (conversation, message, snap) in either direction. Reports are stored
# once per reporter and target. Nothing here ever tells the blocked person they were blocked.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [string]$Token, [byte[]]$RawBody, [string]$ContentType)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 60 }
    if ($Token) { $args.Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $RawBody) { $args.Body = $RawBody; $args.ContentType = $ContentType }
    elseif ($null -ne $Body) { $args.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress)); $args.ContentType = "application/json; charset=utf-8" }
    $status = 0; $raw = ""
    try { $response = Invoke-WebRequest @args; $status = [int]$response.StatusCode; $raw = [string]$response.Content }
    catch {
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

function New-Person {
    param([string]$Prefix)
    $name = "e2e_$Prefix$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    $reg = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $name; email = "$name@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($reg.Status -ne 200) { throw "register $name failed: HTTP $($reg.Status) $($reg.Raw)" }
    Start-Sleep -Milliseconds 5
    [pscustomobject]@{ Name = $name; Id = [string]$reg.Json.userId; Token = [string]$reg.Json.token }
}

Write-Host "BLK-SAFETY-01 block and report via $GatewayBaseUrl"
$ada = New-Person "sa"
$bek = New-Person "sb"
$can = New-Person "sc"
$png = [byte[]](0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x06,0x00,0x00,0x00,0x1F,0x15,0xC4,0x89)

# --- set the scene: friends who already talk
$null = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $bek.Id } -Token $ada.Token
$null = Invoke-Api -Method POST -Path "/api/friends/requests/$($ada.Id)/accept" -Token $bek.Token
$conv = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $ada.Token -Body @{ targetUserId = $bek.Id }
$cid = $conv.Json.id
$hello = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages" -Token $ada.Token -Body @{ text = "selam" }
Check "before a block they can chat" ($conv.Status -eq 200 -and $hello.Status -eq 200) "conv $($conv.Status) msg $($hello.Status)"

# --- guards
$anon = Invoke-Api -Method GET -Path "/api/blocks"
Check "the block list needs a signed-in user" ($anon.Status -eq 401) "HTTP $($anon.Status)"
$self = Invoke-Api -Method POST -Path "/api/blocks" -Body @{ userId = $ada.Id } -Token $ada.Token
Check "you cannot block yourself" ($self.Status -eq 400 -and $self.Json.error -eq "SELF") "HTTP $($self.Status) $($self.Raw)"
$ghost = Invoke-Api -Method POST -Path "/api/blocks" -Body @{ userId = [guid]::NewGuid().ToString() } -Token $ada.Token
Check "an unknown person is a 404" ($ghost.Status -eq 404 -and $ghost.Json.error -eq "USER_NOT_FOUND") "HTTP $($ghost.Status)"
$clear = Invoke-Api -Method GET -Path "/api/blocks/status/$($bek.Id)" -Token $ada.Token
Check "no block yet" ($clear.Status -eq 200 -and $clear.Json.blocked -eq $false) "$($clear.Raw)"

# --- block
$block = Invoke-Api -Method POST -Path "/api/blocks" -Body @{ userId = $bek.Id } -Token $ada.Token
Check "blocking answers relation blocked" ($block.Status -eq 200 -and $block.Json.relation -eq "blocked") "HTTP $($block.Status) $($block.Raw)"
$again = Invoke-Api -Method POST -Path "/api/blocks" -Body @{ userId = $bek.Id } -Token $ada.Token
Check "blocking twice changes nothing" ($again.Status -eq 200 -and $again.Json.relation -eq "blocked") "HTTP $($again.Status)"
$list = Invoke-Api -Method GET -Path "/api/blocks" -Token $ada.Token
Check "the blocker sees who they blocked" ($list.Status -eq 200 -and @($list.Json).Count -eq 1 -and $list.Json[0].id -eq $bek.Id) "$($list.Raw)"
$bekList = Invoke-Api -Method GET -Path "/api/blocks" -Token $bek.Token
Check "the blocked person's own block list stays empty (they are not told)" (@($bekList.Json).Count -eq 0) "$($bekList.Raw)"
$adaFriends = Invoke-Api -Method GET -Path "/api/friends" -Token $ada.Token
$bekFriends = Invoke-Api -Method GET -Path "/api/friends" -Token $bek.Token
Check "blocking ends the friendship on both sides" (@($adaFriends.Json).Count -eq 0 -and @($bekFriends.Json).Count -eq 0) "$($adaFriends.Raw) / $($bekFriends.Raw)"

# --- visibility
$adaSearch = Invoke-Api -Method GET -Path "/api/users/search?q=$($bek.Name)" -Token $ada.Token
$bekSearch = Invoke-Api -Method GET -Path "/api/users/search?q=$($ada.Name)" -Token $bek.Token
$canSearch = Invoke-Api -Method GET -Path "/api/users/search?q=$($bek.Name)" -Token $can.Token
Check "the blocker no longer finds them in search" (@($adaSearch.Json | Where-Object { $_.id -eq $bek.Id }).Count -eq 0) "$($adaSearch.Raw)"
Check "the blocked person no longer finds the blocker in search" (@($bekSearch.Json | Where-Object { $_.id -eq $ada.Id }).Count -eq 0) "$($bekSearch.Raw)"
Check "everybody else still finds both" (@($canSearch.Json | Where-Object { $_.id -eq $bek.Id }).Count -eq 1) "$($canSearch.Raw)"
$adaSees = Invoke-Api -Method GET -Path "/api/users/$($bek.Id)" -Token $ada.Token
Check "the blocker's view of the blocked profile says blocked (so it can be undone)" ($adaSees.Status -eq 200 -and $adaSees.Json.relation -eq "blocked" -and -not $adaSees.Json.bio) "HTTP $($adaSees.Status) $($adaSees.Raw)"
$bekSees = Invoke-Api -Method GET -Path "/api/users/$($ada.Id)" -Token $bek.Token
Check "the blocked person cannot open the blocker's profile (404)" ($bekSees.Status -eq 404) "HTTP $($bekSees.Status)"
$s1 = Invoke-Api -Method GET -Path "/api/blocks/status/$($bek.Id)" -Token $ada.Token
$s2 = Invoke-Api -Method GET -Path "/api/blocks/status/$($ada.Id)" -Token $bek.Token
$s3 = Invoke-Api -Method GET -Path "/api/blocks/status/$($ada.Id)" -Token $can.Token
Check "the block status is true both ways and false for a third person" ($s1.Json.blocked -eq $true -and $s2.Json.blocked -eq $true -and $s3.Json.blocked -eq $false) "$($s1.Raw) $($s2.Raw) $($s3.Raw)"

# --- friend requests
$r1 = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $bek.Id } -Token $ada.Token
$r2 = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $ada.Id } -Token $bek.Token
Check "neither side can send a friend request across a block" ($r1.Status -eq 403 -and $r2.Status -eq 403 -and $r1.Json.error -eq "REQUEST_NOT_ALLOWED" -and $r2.Json.error -eq "REQUEST_NOT_ALLOWED") "HTTP $($r1.Status)/$($r2.Status)"

# --- chat
$m1 = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages" -Token $ada.Token -Body @{ text = "hala orada misin" }
$m2 = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages" -Token $bek.Token -Body @{ text = "evet" }
Check "an existing conversation stops accepting messages, in both directions" ($m1.Status -eq 403 -and $m2.Status -eq 403) "HTTP $($m1.Status)/$($m2.Status) $($m1.Raw)"
Check "the refusal does not say who blocked whom" ($m2.Raw -notmatch "engelle" -and $m2.Raw -notmatch "block") "$($m2.Raw)"
$sn1 = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps?durationSeconds=5" -Token $ada.Token -RawBody $png -ContentType "image/png"
$sn2 = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps?durationSeconds=5" -Token $bek.Token -RawBody $png -ContentType "image/png"
Check "snaps are refused across a block too" ($sn1.Status -eq 403 -and $sn2.Status -eq 403) "HTTP $($sn1.Status)/$($sn2.Status)"
$st1 = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $ada.Token -Body @{ targetUserId = $bek.Id }
$st2 = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $bek.Token -Body @{ targetUserId = $ada.Id }
Check "a new conversation cannot be started across a block" ($st1.Status -eq 403 -and $st2.Status -eq 403) "HTTP $($st1.Status)/$($st2.Status)"
$withCan = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $ada.Token -Body @{ targetUserId = $can.Id }
$canMsg = Invoke-Api -Method POST -Path "/api/chat/conversations/$($withCan.Json.id)/messages" -Token $ada.Token -Body @{ text = "merhaba can" }
Check "chat with everybody else is untouched" ($withCan.Status -eq 200 -and $canMsg.Status -eq 200) "conv $($withCan.Status) msg $($canMsg.Status)"

# --- comments and reactions: the block reaches the signals too (the same 404 as a blocked profile)
function New-Signal([string]$Token, [string]$Disclosure) {
    $lat = 37.0 + (Get-Random -Minimum 100000 -Maximum 999999) / 10000000; $lon = 36.2 + (Get-Random -Minimum 100000 -Maximum 999999) / 10000000
    $p = Invoke-Api -Method POST -Path "/api/posts" -Token $Token -Body @{ title = ""; content = "Engel smoke"; latitude = $lat; longitude = $lon; accuracyMeters = 20; locationName = "Sokak"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = $Disclosure; locationPrecision = "ApproximateArea" }
    $id = [string]$p.Json.postId
    for ($i = 0; $i -lt 30; $i++) { if ((Invoke-Api -Method GET -Path "/api/posts/$id" -Token $can.Token).Status -eq 200) { break }; Start-Sleep -Milliseconds 500 }
    $id
}
$adaPost = New-Signal $ada.Token "LimitedProfile"
$adaAnon = New-Signal $ada.Token "AnonymousMap"
$canPost = New-Signal $can.Token "LimitedProfile"
$adaComment = [string](Invoke-Api -Method POST -Path "/api/posts/$canPost/comments" -Token $ada.Token -Body @{ commentText = "Ada'nin yorumu" }).Json.commentId
for ($i = 0; $i -lt 30; $i++) { if ((Invoke-Api -Method GET -Path "/api/posts/$canPost/comments" -Token $can.Token).Raw.Contains($adaComment)) { break }; Start-Sleep -Milliseconds 500 }
$bc = Invoke-Api -Method POST -Path "/api/posts/$adaPost/comments" -Token $bek.Token -Body @{ commentText = "yine ben" }
$br = Invoke-Api -Method POST -Path "/api/posts/$adaPost/reactions" -Token $bek.Token -Body @{ reaction = [char]::ConvertFromUtf32(0x1F525) }
$bl = Invoke-Api -Method POST -Path "/api/posts/$adaPost/likes" -Token $bek.Token
Check "a blocked person cannot comment on, react to or like the blocker's signal" ($bc.Status -eq 404 -and $br.Status -eq 404 -and $bl.Status -eq 404) "HTTP $($bc.Status)/$($br.Status)/$($bl.Status)"
Check "the refusal looks like a missing signal, not a block" ($bc.Json.code -eq "NOT_FOUND" -and $bc.Raw -notmatch "block|engel") "$($bc.Raw)"
$reply = Invoke-Api -Method POST -Path "/api/posts/$canPost/comments" -Token $bek.Token -Body @{ commentText = "cevap"; parentCommentId = $adaComment }
$clike = Invoke-Api -Method POST -Path "/api/posts/$canPost/comments/$adaComment/like" -Token $bek.Token
Check "nor reply to or like the blocker's comment under someone else's signal" ($reply.Status -eq 404 -and $clike.Status -eq 404) "HTTP $($reply.Status)/$($clike.Status)"
$other = Invoke-Api -Method POST -Path "/api/posts/$canPost/comments" -Token $bek.Token -Body @{ commentText = "Can'a yorum" }
$canOnAda = Invoke-Api -Method POST -Path "/api/posts/$adaPost/comments" -Token $can.Token -Body @{ commentText = "Ada'ya yorum" }
Check "everybody else's signals and comments are untouched" ($other.Status -eq 200 -and $canOnAda.Status -eq 200) "HTTP $($other.Status)/$($canOnAda.Status)"
$anonReact = Invoke-Api -Method POST -Path "/api/posts/$adaAnon/reactions" -Token $bek.Token -Body @{ reaction = [char]::ConvertFromUtf32(0x1F525) }
Check "an anonymous signal does not give its author away through a refusal" ($anonReact.Status -eq 200) "HTTP $($anonReact.Status) $($anonReact.Raw)"

# --- unblock
$unblock = Invoke-Api -Method DELETE -Path "/api/blocks/$($bek.Id)" -Token $ada.Token
Check "unblocking answers relation none" ($unblock.Status -eq 200 -and $unblock.Json.relation -eq "none") "HTTP $($unblock.Status) $($unblock.Raw)"
$afterMsg = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages" -Token $bek.Token -Body @{ text = "yine buradayim" }
Check "after unblocking they can talk again" ($afterMsg.Status -eq 200) "HTTP $($afterMsg.Status) $($afterMsg.Raw)"
$afterComment = Invoke-Api -Method POST -Path "/api/posts/$adaPost/comments" -Token $bek.Token -Body @{ commentText = "tekrar merhaba" }
Check "and comment on the other one's signals again" ($afterComment.Status -eq 200) "HTTP $($afterComment.Status) $($afterComment.Raw)"
$afterFriends = Invoke-Api -Method GET -Path "/api/friends" -Token $ada.Token
Check "the friendship is not restored by unblocking" (@($afterFriends.Json).Count -eq 0) "$($afterFriends.Raw)"
$afterAdd = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $bek.Id } -Token $ada.Token
Check "and a fresh request works again" ($afterAdd.Status -eq 200 -and $afterAdd.Json.relation -eq "outgoing") "HTTP $($afterAdd.Status) $($afterAdd.Raw)"

# --- reports
$rAnon = Invoke-Api -Method POST -Path "/api/reports" -Body @{ targetType = "user"; targetId = $bek.Id; reason = "spam" }
Check "reporting needs a signed-in user" ($rAnon.Status -eq 401) "HTTP $($rAnon.Status)"
$rUser = Invoke-Api -Method POST -Path "/api/reports" -Body @{ targetType = "user"; targetId = $bek.Id; reason = "harassment"; note = "  rahatsiz   ediyor  " } -Token $ada.Token
Check "a user report is accepted" ($rUser.Status -eq 200 -and $rUser.Json.reported -eq $true) "HTTP $($rUser.Status) $($rUser.Raw)"
$rTwice = Invoke-Api -Method POST -Path "/api/reports" -Body @{ targetType = "user"; targetId = $bek.Id; reason = "spam" } -Token $ada.Token
Check "the same report twice is still a calm 200" ($rTwice.Status -eq 200 -and $rTwice.Json.reported -eq $true) "HTTP $($rTwice.Status)"
$rSignal = Invoke-Api -Method POST -Path "/api/reports" -Body @{ targetType = "signal"; targetId = [guid]::NewGuid().ToString(); reason = "wrong_info" } -Token $ada.Token
Check "a signal report is accepted" ($rSignal.Status -eq 200 -and $rSignal.Json.reported -eq $true) "HTTP $($rSignal.Status) $($rSignal.Raw)"
$rSelf = Invoke-Api -Method POST -Path "/api/reports" -Body @{ targetType = "user"; targetId = $ada.Id; reason = "spam" } -Token $ada.Token
Check "you cannot report yourself" ($rSelf.Status -eq 400 -and $rSelf.Json.error -eq "SELF") "HTTP $($rSelf.Status)"
$rGhost = Invoke-Api -Method POST -Path "/api/reports" -Body @{ targetType = "user"; targetId = [guid]::NewGuid().ToString(); reason = "spam" } -Token $ada.Token
Check "an unknown person is a 404" ($rGhost.Status -eq 404) "HTTP $($rGhost.Status)"
$rBadReason = Invoke-Api -Method POST -Path "/api/reports" -Body @{ targetType = "user"; targetId = $can.Id; reason = "because" } -Token $ada.Token
$rBadType = Invoke-Api -Method POST -Path "/api/reports" -Body @{ targetType = "place"; targetId = $can.Id; reason = "spam" } -Token $ada.Token
$rBadSignal = Invoke-Api -Method POST -Path "/api/reports" -Body @{ targetType = "signal"; targetId = "<script>"; reason = "spam" } -Token $ada.Token
Check "unknown reason, type or a malformed signal id are 400 INVALID_REPORT" ($rBadReason.Status -eq 400 -and $rBadType.Status -eq 400 -and $rBadSignal.Status -eq 400 -and $rBadReason.Json.error -eq "INVALID_REPORT") "HTTP $($rBadReason.Status)/$($rBadType.Status)/$($rBadSignal.Status)"
$rLong = Invoke-Api -Method POST -Path "/api/reports" -Body @{ targetType = "user"; targetId = $can.Id; reason = "spam"; note = ("x" * 301) } -Token $ada.Token
Check "a 301-character note is a 400 NOTE_TOO_LONG" ($rLong.Status -eq 400 -and $rLong.Json.error -eq "NOTE_TOO_LONG") "HTTP $($rLong.Status)"

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-SAFETY-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "`nPASS BLK-SAFETY-01 block and report"
