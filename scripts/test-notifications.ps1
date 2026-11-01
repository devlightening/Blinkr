param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-NOTIFY-01 (sinyal-mvp-plan Faz 9): likes, comments, follows, follow requests and accepted requests each leave a
# notification for the right person, with who did it and what it is about; unread counts and "mark all read" work;
# nobody is notified about their own action.

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
    $userName = "e2e_ntf_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

# Waits (up to ~20 s) until the user has a notification of the given type from the given actor.
function Wait-Notification {
    param($User, [string]$Type, [string]$ActorId)
    for ($i = 0; $i -lt 40; $i++) {
        $list = Invoke-Api -Method GET -Path "/api/notifications?pageSize=50" -Token $User.Token
        $hit = @($list.Json.items | Where-Object { $_.type -eq $Type -and $_.actorUserId -eq $ActorId })
        if ($hit.Count -gt 0) { return $hit[0] }
        Start-Sleep -Milliseconds 500
    }
    return $null
}

Write-Host "BLK-NOTIFY-01 notifications via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$owner = Register-SmokeUser -Label "owner" -Suffix $suffix
$fan = Register-SmokeUser -Label "fan" -Suffix $suffix
$asker = Register-SmokeUser -Label "asker" -Suffix $suffix

$post = Invoke-Api -Method POST -Path "/api/posts" -Token $owner.Token -Body @{ title = "ntf-$suffix"; content = "Notification smoke."; signalType = "GeneralObservation"; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25; locationName = "Osmaniye"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea" }
$postId = $post.Json.postId
for ($i = 0; $i -lt 30; $i++) { if ((Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $fan.Token).Status -eq 200) { break }; Start-Sleep -Milliseconds 500 }

$null = Invoke-Api -Method POST -Path "/api/posts/$postId/likes" -Token $fan.Token
$like = Wait-Notification -User $owner -Type "PostLiked" -ActorId $fan.Id
Check "a like notifies the post owner, with the liker's name" ($like -and $like.postId -eq $postId -and $like.actorUserName -eq $fan.UserName -and $like.body.Contains($fan.UserName)) "$($like | ConvertTo-Json -Compress)"

$null = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $fan.Token -Body @{ commentText = "Sıra var mı?" }
$comment = Wait-Notification -User $owner -Type "CommentCreated" -ActorId $fan.Id
Check "a comment notifies the owner and points at the post" ($comment -and $comment.postId -eq $postId -and $comment.actorUserName -eq $fan.UserName) "$($comment | ConvertTo-Json -Compress)"

$null = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $owner.Token -Body @{ commentText = "Evet" }
Start-Sleep -Seconds 2
$own = Invoke-Api -Method GET -Path "/api/notifications?pageSize=50" -Token $owner.Token
Check "nobody is notified about their own comment" (@($own.Json.items | Where-Object { $_.actorUserId -eq $owner.Id }).Count -eq 0)

$null = Invoke-Api -Method POST -Path "/api/follows/$($owner.Id)" -Token $fan.Token
$follow = Wait-Notification -User $owner -Type "UserFollowed" -ActorId $fan.Id
Check "a follow notifies the followed person" ($follow -and $follow.body.Contains($fan.UserName)) "$($follow | ConvertTo-Json -Compress)"

$null = Invoke-Api -Method PUT -Path "/api/users/me/privacy" -Token $owner.Token -Body @{ isPrivate = $true }
$null = Invoke-Api -Method POST -Path "/api/follows/$($owner.Id)" -Token $asker.Token
$request = Wait-Notification -User $owner -Type "FollowRequested" -ActorId $asker.Id
Check "a follow request notifies the private account" ($null -ne $request)
$null = Invoke-Api -Method POST -Path "/api/follows/requests/$($asker.Id)/accept" -Token $owner.Token
$accepted = Wait-Notification -User $asker -Type "FollowAccepted" -ActorId $owner.Id
Check "accepting tells the one who asked" ($accepted -and $accepted.body.Contains($owner.UserName))

$count = Invoke-Api -Method GET -Path "/api/notifications/unread-count" -Token $owner.Token
Check "the owner has unread notifications" ($count.Json.unreadCount -ge 4) "count=$($count.Json.unreadCount)"
$mark = Invoke-Api -Method POST -Path "/api/notifications/mark-read" -Token $owner.Token -Body @{ notificationIds = @() }
$after = Invoke-Api -Method GET -Path "/api/notifications/unread-count" -Token $owner.Token
Check "mark all read clears the count" ($mark.Status -lt 300 -and $after.Json.unreadCount -eq 0) "HTTP $($mark.Status) count=$($after.Json.unreadCount)"
$otherCount = Invoke-Api -Method GET -Path "/api/notifications/unread-count" -Token $asker.Token
Check "someone else's notifications are untouched" ($otherCount.Json.unreadCount -ge 1)

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-NOTIFY-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    exit 1
}
Write-Host "`nPASS BLK-NOTIFY-01 notifications"
