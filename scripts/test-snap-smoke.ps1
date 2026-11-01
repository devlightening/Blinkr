param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-SNAP-01: view-once photo/video messages. The media is private (recipient only), opens exactly once, its
# viewing window and expiry are enforced by the server, photos lose their EXIF, and the conversation list and the
# unread count reflect "new snap" correctly.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [string]$Token, [byte[]]$RawBody, [string]$ContentType)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 60 }
    if ($Token) { $args.Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $RawBody) { $args.Body = $RawBody; $args.ContentType = $ContentType }
    elseif ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Compress); $args.ContentType = "application/json" }
    $status = 0; $headers = $null; $bytes = [byte[]]@(); $raw = ""
    try {
        $response = Invoke-WebRequest @args
        $status = [int]$response.StatusCode; $headers = $response.Headers
        $ms = New-Object System.IO.MemoryStream; $response.RawContentStream.CopyTo($ms); $bytes = $ms.ToArray()
        $raw = [System.Text.Encoding]::UTF8.GetString($bytes)
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        $status = [int]$response.StatusCode; $headers = $response.Headers
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream()); $raw = $reader.ReadToEnd(); $reader.Dispose()
    }
    $json = $null
    if ($raw.TrimStart().StartsWith("{") -or $raw.TrimStart().StartsWith("[")) { try { $json = $raw | ConvertFrom-Json } catch { } }
    [pscustomobject]@{ Status = $status; Json = $json; Raw = $raw; Bytes = $bytes; Headers = $headers }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

function New-User {
    param([string]$Prefix)
    $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $name = "e2e_$Prefix$suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $name; email = "$name@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200) { throw "cannot register $name : HTTP $($r.Status) $($r.Raw)" }
    Start-Sleep -Milliseconds 5
    [pscustomobject]@{ Id = $r.Json.userId; Token = $r.Json.token; Name = $name }
}

function Set-SnapTimes {
    param([string]$MessageId, [string]$Field, [int]$MinutesAgo)
    $js = "db.chat_messages.updateOne({ _id: ObjectId('$MessageId') }, { `$set: { '$Field': new Date(Date.now() - $($MinutesAgo * 60000)) } })"
    & docker exec blinkr_mongodb mongosh "mongodb://localhost:27017/blinkr_notifications" --quiet --eval $js | Out-Null
}

Write-Host "BLK-SNAP-01 snaps via $GatewayBaseUrl"
$a = New-User "snap_a_"; $b = New-User "snap_b_"; $c = New-User "snap_c_"

$conv = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $b.Id }
$cid = $conv.Json.id
Check "conversation starts" ($conv.Status -eq 200 -and $cid)

# A tiny valid PNG, a JPEG that carries an EXIF (APP1) segment, and an MP4 header.
$png = [byte[]](0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x06,0x00,0x00,0x00,0x1F,0x15,0xC4,0x89)
$jpegWithExif = [byte[]](0xFF,0xD8, 0xFF,0xE1,0x00,0x0A,0x45,0x78,0x69,0x66,0x00,0x00,0x47,0x50, 0xFF,0xDB,0x00,0x04,0x00,0x00, 0xFF,0xD9)
$mp4 = [byte[]](0x00,0x00,0x00,0x18,0x66,0x74,0x79,0x70,0x69,0x73,0x6F,0x6D,0x00,0x00,0x02,0x00,0x69,0x73,0x6F,0x6D,0x69,0x73,0x6F,0x32)

# ---- sending
$sent = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps?durationSeconds=5&caption=$([uri]::EscapeDataString('Merhaba'))" -Token $a.Token -RawBody $png -ContentType "image/png"
Check "a participant can send a photo snap" ($sent.Status -eq 200 -and $sent.Json.kind -eq "snap" -and $sent.Json.snap.state -eq "sent" -and $sent.Json.snap.durationSeconds -eq 5 -and $sent.Json.snap.caption -eq "Merhaba") "HTTP $($sent.Status) $($sent.Raw)"
$snapId = $sent.Json.id
Check "the message carries no media, url or storage key" (-not ($sent.Raw -match "(?i)objectkey|contentUrl|\.bin"))

$outsider = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps" -Token $c.Token -RawBody $png -ContentType "image/png"
Check "a non-participant cannot send into the conversation" ($outsider.Status -eq 403) "HTTP $($outsider.Status)"
$wrongType = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps" -Token $a.Token -RawBody $png -ContentType "text/plain"
Check "an unsupported content type is a 400" ($wrongType.Status -eq 400) "HTTP $($wrongType.Status)"
$lying = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps" -Token $a.Token -RawBody $png -ContentType "image/jpeg"
Check "bytes that do not match the declared type are a 400" ($lying.Status -eq 400) "HTTP $($lying.Status)"
$tooLong = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps?durationSeconds=60" -Token $a.Token -RawBody $png -ContentType "image/png"
Check "a timer above 10 seconds is a 400" ($tooLong.Status -eq 400) "HTTP $($tooLong.Status)"
$empty = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps" -Token $a.Token -RawBody ([byte[]]@()) -ContentType "image/png"
Check "an empty file is a 400" ($empty.Status -eq 400) "HTTP $($empty.Status)"

# ---- the recipient's view before opening
$listB = Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $b.Token
$rowB = @($listB.Json.items) | Where-Object { $_.id -eq $cid } | Select-Object -First 1
Check "the list shows a waiting snap from the other person" ($rowB.lastMessageKind -eq "snap" -and $rowB.lastMessageState -eq "sent" -and $rowB.lastMessageSenderId -eq $a.Id -and $rowB.unreadCount -eq 1) ($listB.Raw)
$listA = Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $a.Token
$rowA = @($listA.Json.items) | Where-Object { $_.id -eq $cid } | Select-Object -First 1
Check "the list carries the id of the latest message so a waiting snap can open straight from the row" ($rowB.lastMessageId -eq $snapId) "row: $($listB.Raw)"
Check "the sender sees it as sent, with nothing unread" ($rowA.lastMessageKind -eq "snap" -and $rowA.lastMessageState -eq "sent" -and $rowA.unreadCount -eq 0)

$readAll = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/read" -Token $b.Token
$afterRead = (Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $b.Token).Json.items | Where-Object { $_.id -eq $cid } | Select-Object -First 1
Check "opening the conversation does not consume a waiting snap" ($readAll.Status -eq 204 -and $afterRead.unreadCount -eq 1)

$early = Invoke-Api -Method GET -Path "/api/chat/snaps/$snapId/content" -Token $b.Token
Check "the media cannot be fetched before the snap is opened (410)" ($early.Status -eq 410 -and $early.Json.error -eq "SNAP_NOT_OPENED") "HTTP $($early.Status) $($early.Raw)"
$ownOpen = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages/$snapId/open" -Token $a.Token
Check "the sender cannot open their own snap (403)" ($ownOpen.Status -eq 403) "HTTP $($ownOpen.Status)"
$ownContent = Invoke-Api -Method GET -Path "/api/chat/snaps/$snapId/content" -Token $a.Token
Check "the sender cannot fetch the media (403)" ($ownContent.Status -eq 403) "HTTP $($ownContent.Status)"
$outOpen = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages/$snapId/open" -Token $c.Token
Check "an outsider cannot open it (403)" ($outOpen.Status -eq 403) "HTTP $($outOpen.Status)"
$outContent = Invoke-Api -Method GET -Path "/api/chat/snaps/$snapId/content" -Token $c.Token
Check "an outsider cannot fetch the media (403)" ($outContent.Status -eq 403) "HTTP $($outContent.Status)"
$anon = Invoke-Api -Method GET -Path "/api/chat/snaps/$snapId/content"
Check "an anonymous caller cannot fetch the media (401)" ($anon.Status -eq 401) "HTTP $($anon.Status)"

# ---- opening: exactly once
$open = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages/$snapId/open" -Token $b.Token
Check "the recipient opens it and learns the timer and where to fetch" ($open.Status -eq 200 -and $open.Json.durationSeconds -eq 5 -and $open.Json.mediaType -eq "Image" -and $open.Json.caption -eq "Merhaba" -and $open.Json.contentUrl -like "*/api/chat/snaps/$snapId/content") "HTTP $($open.Status) $($open.Raw)"
$again = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages/$snapId/open" -Token $b.Token
Check "a second open is refused (410 SNAP_OPENED)" ($again.Status -eq 410 -and $again.Json.error -eq "SNAP_OPENED") "HTTP $($again.Status) $($again.Raw)"
$content = Invoke-Api -Method GET -Path "/api/chat/snaps/$snapId/content" -Token $b.Token
Check "the recipient fetches the media inside the window" ($content.Status -eq 200 -and $content.Bytes.Length -eq $png.Length -and [System.BitConverter]::ToString($content.Bytes) -eq [System.BitConverter]::ToString($png)) "HTTP $($content.Status)"
Check "the media is served as its type and is never cached" ($content.Headers["Content-Type"] -like "image/png*" -and $content.Headers["Cache-Control"] -match "no-store")
$afterOpenList = (Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $b.Token).Json.items | Where-Object { $_.id -eq $cid } | Select-Object -First 1
Check "after opening nothing is unread and the state is opened" ($afterOpenList.unreadCount -eq 0 -and $afterOpenList.lastMessageState -eq "opened")
$sentSide = (Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $a.Token).Json.items | Where-Object { $_.id -eq $cid } | Select-Object -First 1
Check "the sender sees that it was opened" ($sentSide.lastMessageState -eq "opened")

# The viewing window is enforced by the server: once it is over the media is gone for good.
Set-SnapTimes -MessageId $snapId -Field "Snap.OpenedAtUtc" -MinutesAgo 10
$late = Invoke-Api -Method GET -Path "/api/chat/snaps/$snapId/content" -Token $b.Token
Check "after the viewing window the media is gone (410)" ($late.Status -eq 410) "HTTP $($late.Status)"
$lateAgain = Invoke-Api -Method GET -Path "/api/chat/snaps/$snapId/content" -Token $b.Token
Check "and it stays gone" ($lateAgain.Status -eq 410)

# ---- privacy: EXIF is removed from photos
$exifSnap = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps?durationSeconds=3" -Token $a.Token -RawBody $jpegWithExif -ContentType "image/jpeg"
Check "a JPEG with EXIF is accepted" ($exifSnap.Status -eq 200) "HTTP $($exifSnap.Status) $($exifSnap.Raw)"
$exifId = $exifSnap.Json.id
Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages/$exifId/open" -Token $b.Token | Out-Null
$exifContent = Invoke-Api -Method GET -Path "/api/chat/snaps/$exifId/content" -Token $b.Token
$hasApp1 = $false
for ($i = 0; $i -lt $exifContent.Bytes.Length - 1; $i++) { if ($exifContent.Bytes[$i] -eq 0xFF -and $exifContent.Bytes[$i + 1] -eq 0xE1) { $hasApp1 = $true } }
Check "the EXIF (APP1) segment is stripped from the stored photo" ($exifContent.Status -eq 200 -and -not $hasApp1 -and $exifContent.Bytes[0] -eq 0xFF -and $exifContent.Bytes[1] -eq 0xD8)

# ---- video snaps play to their end (no timer) and expire unopened
$video = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps?durationSeconds=7" -Token $b.Token -RawBody $mp4 -ContentType "video/mp4"
Check "a video snap is accepted and plays to its end (timer 0)" ($video.Status -eq 200 -and $video.Json.snap.mediaType -eq "Video" -and $video.Json.snap.durationSeconds -eq 0) "HTTP $($video.Status) $($video.Raw)"

$stale = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/snaps" -Token $a.Token -RawBody $png -ContentType "image/png"
$staleId = $stale.Json.id
Set-SnapTimes -MessageId $staleId -Field "Snap.ExpiresAtUtc" -MinutesAgo 5
$expiredOpen = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages/$staleId/open" -Token $b.Token
Check "an expired snap cannot be opened (410 SNAP_EXPIRED)" ($expiredOpen.Status -eq 410 -and $expiredOpen.Json.error -eq "SNAP_EXPIRED") "HTTP $($expiredOpen.Status) $($expiredOpen.Raw)"
$messages = Invoke-Api -Method GET -Path "/api/chat/conversations/$cid/messages" -Token $b.Token
$staleRow = @($messages.Json.items) | Where-Object { $_.id -eq $staleId } | Select-Object -First 1
Check "an expired snap reads as expired in the message list" ($staleRow.snap.state -eq "expired")
$unreadNow = ((Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $b.Token).Json.items | Where-Object { $_.id -eq $cid } | Select-Object -First 1).unreadCount
Check "an expired snap no longer counts as unread" ($unreadNow -eq 0) "unread $unreadNow"

# ---- text keeps working next to snaps
$text = Invoke-Api -Method POST -Path "/api/chat/conversations/$cid/messages" -Token $a.Token -Body @{ text = "Selam" }
Check "plain text messages still work and are kind text" ($text.Status -eq 200 -and $text.Json.kind -eq "text" -and -not $text.Json.snap)
$row = (Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $b.Token).Json.items | Where-Object { $_.id -eq $cid } | Select-Object -First 1
Check "the list follows the latest message (text, unread 1)" ($row.lastMessageKind -eq "text" -and $row.unreadCount -eq 1)

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-SNAP-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "`nPASS BLK-SNAP-01 snaps"
