param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-AUTHZ-01 (sinyal-mvp-plan Faz 10 P10.9, 11 §6): one person trying to reach another person's things, through the
# Gateway. Every attempt must be refused (401 without a token, 403/404 with someone else's token) and must leave the
# resource untouched. Covers posts, comments, private accounts, blocks, chat, snaps, stories and the admin queue.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body, [byte[]]$Bytes, [string]$ContentType)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress -Depth 5)); $args.ContentType = "application/json; charset=utf-8" }
    if ($null -ne $Bytes) { $args.Body = $Bytes; $args.ContentType = $ContentType }
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
function Refused($r) { return $r.Status -eq 403 -or $r.Status -eq 404 }

function Register-SmokeUser {
    param([string]$Label, [string]$Suffix)
    $userName = "e2e_az_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

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

Write-Host "BLK-AUTHZ-01 authorization via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$owner = Register-SmokeUser -Label "owner" -Suffix $suffix
$friend = Register-SmokeUser -Label "friend" -Suffix $suffix
$intruder = Register-SmokeUser -Label "intruder" -Suffix $suffix

# --- Posts and comments
$post = Invoke-Api -Method POST -Path "/api/posts" -Token $owner.Token -Body @{ title = "Sahibin sinyali"; content = "Yalniz sahibi degistirebilir."; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25; locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea" }
$postId = $post.Json.postId
Wait-Until -Path "/api/posts/$postId" -Token $owner.Token -Until { param($r) $r.Status -eq 200 } | Out-Null

Check "creating a post needs a token" ((Invoke-Api -Method POST -Path "/api/posts" -Body @{ title = "x"; content = "anonymous write" }).Status -eq 401)
$edit = Invoke-Api -Method PUT -Path "/api/posts/$postId" -Token $intruder.Token -Body @{ title = "Ele gecirildi"; content = "Baskasinin sinyali" }
Check "someone else cannot edit my post" (Refused $edit) "HTTP $($edit.Status)"
$del = Invoke-Api -Method DELETE -Path "/api/posts/$postId" -Token $intruder.Token
Check "someone else cannot delete my post" (Refused $del) "HTTP $($del.Status)"
Start-Sleep -Seconds 2
$still = Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $owner.Token
Check "my post is unchanged after the attempts" ($still.Status -eq 200 -and $still.Json.title -eq "Sahibin sinyali") "HTTP $($still.Status) title=$($still.Json.title)"

$comment = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $friend.Token -Body @{ commentText = "Arkadasin yorumu" }
$commentId = $comment.Json.commentId
Wait-Until -Path "/api/posts/$postId/comments" -Token $owner.Token -Until { param($r) $r.Json.commentCount -ge 1 } | Out-Null
$delComment = Invoke-Api -Method DELETE -Path "/api/posts/$postId/comments/$commentId" -Token $intruder.Token
Check "a stranger cannot delete someone's comment" (Refused $delComment) "HTTP $($delComment.Status)"
$likeAnon = Invoke-Api -Method POST -Path "/api/posts/$postId/likes"
Check "liking needs a token" ($likeAnon.Status -eq 401) "HTTP $($likeAnon.Status)"

# --- Private account: a non-follower cannot read the signals
$null = Invoke-Api -Method PUT -Path "/api/users/me/privacy" -Token $owner.Token -Body @{ isPrivate = $true }
$authorPosts = Invoke-Api -Method GET -Path "/api/posts-read/author/$($owner.Id)?page=1&pageSize=20" -Token $intruder.Token
Check "a private account's signals are closed to a non-follower" ((Refused $authorPosts) -or ($authorPosts.Status -eq 200 -and $authorPosts.Raw -notmatch $postId)) "HTTP $($authorPosts.Status)"
$stories = Invoke-Api -Method GET -Path "/api/stories/users/$($owner.Id)" -Token $intruder.Token
Check "a private account's stories are closed to a non-follower" ((Refused $stories) -or ($stories.Status -eq 200 -and @($stories.Json).Count -eq 0)) "HTTP $($stories.Status)"
$null = Invoke-Api -Method PUT -Path "/api/users/me/privacy" -Token $owner.Token -Body @{ isPrivate = $false }

# --- Stories: only the author sees who viewed or can delete
$gps = [System.Text.Encoding]::ASCII.GetBytes("x")
$jpeg = [byte[]](0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x02, 0x11, 0x22, 0xFF, 0xD9)
$story = Invoke-Api -Method POST -Path "/api/stories?durationSeconds=5" -Token $owner.Token -Bytes $jpeg -ContentType "image/jpeg"
$storyId = $story.Json.id
if ($storyId) {
    $viewers = Invoke-Api -Method GET -Path "/api/stories/$storyId/viewers" -Token $intruder.Token
    Check "only the author sees who viewed a story" (Refused $viewers) "HTTP $($viewers.Status)"
    $delStory = Invoke-Api -Method DELETE -Path "/api/stories/$storyId" -Token $intruder.Token
    Check "someone else cannot delete my story" (Refused $delStory) "HTTP $($delStory.Status)"
    $ownDelete = Invoke-Api -Method DELETE -Path "/api/stories/$storyId" -Token $owner.Token
    Check "the author can delete their story" ($ownDelete.Status -in 200, 204) "HTTP $($ownDelete.Status)"
} else {
    Check "story created for the checks" $false "HTTP $($story.Status) $($story.Raw)"
}

# --- Chat: a third person cannot read, write, react, unsend or open snaps in someone's conversation
$conv = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $owner.Token -Body @{ targetUserId = $friend.Id }
$convId = $conv.Json.id
$msg = Invoke-Api -Method POST -Path "/api/chat/conversations/$convId/messages" -Token $owner.Token -Body @{ text = "Ozel mesaj" }
$msgId = $msg.Json.id
$read = Invoke-Api -Method GET -Path "/api/chat/conversations/$convId/messages" -Token $intruder.Token
Check "a third person cannot read the conversation" (Refused $read -and $read.Raw -notmatch "Ozel mesaj") "HTTP $($read.Status)"
$write = Invoke-Api -Method POST -Path "/api/chat/conversations/$convId/messages" -Token $intruder.Token -Body @{ text = "araya giriyorum" }
Check "a third person cannot write into it" (Refused $write) "HTTP $($write.Status)"
$react = Invoke-Api -Method PUT -Path "/api/chat/conversations/$convId/messages/$msgId/reaction" -Token $intruder.Token -Body @{ emoji = "👍" }
Check "a third person cannot react in it" (Refused $react) "HTTP $($react.Status)"
$unsend = Invoke-Api -Method DELETE -Path "/api/chat/conversations/$convId/messages/$msgId" -Token $friend.Token
Check "the recipient cannot unsend the sender's message" ((Refused $unsend) -or $unsend.Status -eq 400) "HTTP $($unsend.Status)"
$snap = Invoke-Api -Method POST -Path "/api/chat/conversations/$convId/snaps?durationSeconds=5" -Token $owner.Token -Bytes $jpeg -ContentType "image/jpeg"
$snapId = $snap.Json.id
if ($snapId) {
    $openOther = Invoke-Api -Method POST -Path "/api/chat/conversations/$convId/messages/$snapId/open" -Token $intruder.Token
    Check "a third person cannot open the snap" (Refused $openOther) "HTTP $($openOther.Status)"
    $content = Invoke-Api -Method GET -Path "/api/chat/snaps/$snapId/content" -Token $intruder.Token
    Check "a third person cannot fetch the snap media" (Refused $content) "HTTP $($content.Status)"
} else {
    Check "snap sent for the checks" $false "HTTP $($snap.Status) $($snap.Raw)"
}

# --- Blocks: a blocked person cannot see my profile or message me
$null = Invoke-Api -Method POST -Path "/api/blocks" -Token $owner.Token -Body @{ userId = $intruder.Id }
$profile = Invoke-Api -Method GET -Path "/api/users/$($owner.Id)" -Token $intruder.Token
Check "a blocked person cannot open my profile" ($profile.Status -eq 404) "HTTP $($profile.Status)"
$newConv = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $intruder.Token -Body @{ targetUserId = $owner.Id }
Check "a blocked person cannot start a chat with me" ($newConv.Status -eq 403) "HTTP $($newConv.Status)"
$unblockOther = Invoke-Api -Method DELETE -Path "/api/blocks/$($owner.Id)" -Token $intruder.Token
$profileAgain = Invoke-Api -Method GET -Path "/api/users/$($owner.Id)" -Token $intruder.Token
Check "the blocked person cannot lift my block" ($profileAgain.Status -eq 404) "HTTP $($profileAgain.Status)"

# --- Personal lists are only ever mine
$notes = Invoke-Api -Method GET -Path "/api/notifications?userId=$($owner.Id)" -Token $intruder.Token
Check "notifications are only my own, whatever the query says" ($notes.Status -eq 200 -and $notes.Raw -notmatch $owner.Id) "HTTP $($notes.Status)"
$saved = Invoke-Api -Method GET -Path "/api/users/me/saved-places?userId=$($owner.Id)" -Token $intruder.Token
Check "saved places are only my own" ($saved.Status -in 200, 404 -and $saved.Raw -notmatch $owner.Id) "HTTP $($saved.Status)"

# --- Admin
$admin = Invoke-Api -Method GET -Path "/api/admin/reports" -Token $intruder.Token
Check "a normal user cannot open the moderation queue" ($admin.Status -eq 403) "HTTP $($admin.Status)"
$forged = Invoke-Api -Method GET -Path "/api/admin/reports" -Token ($intruder.Token.Substring(0, $intruder.Token.Length - 4) + "abcd")
Check "a tampered token is rejected" ($forged.Status -eq 401) "HTTP $($forged.Status)"

if ($script:failures.Count -gt 0) {
    Write-Host "BLK-AUTHZ-01 FAILED: $($script:failures -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "BLK-AUTHZ-01 PASS"
