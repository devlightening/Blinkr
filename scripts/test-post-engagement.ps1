param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-ENGAGE-01: likes and comments on a signal, end to end through EventStore -> RabbitMQ -> projection.
# Likes toggle and are counted once per person; "did I like this?" is per viewer; you cannot like your own
# post; comments carry the author's name, replies nest one level, only the comment author or post author can
# delete, and on an AnonymousMap post the post author's own comment never reveals who they are (constitution 10.3).

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Compress); $args.ContentType = "application/json; charset=utf-8" }
    $status = 0; $raw = ""; $headers = $null
    try {
        $response = Invoke-WebRequest @args
        $status = [int]$response.StatusCode; $raw = [string]$response.Content; $headers = $response.Headers
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        $status = [int]$response.StatusCode
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream()); $raw = $reader.ReadToEnd(); $reader.Dispose()
    }
    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) { try { $json = $raw | ConvertFrom-Json } catch { } }
    [pscustomobject]@{ Status = $status; Raw = $raw; Json = $json; Headers = $headers }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

function Register-SmokeUser {
    param([string]$Label, [string]$Suffix)
    $userName = "e2e_eng_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

function New-Post {
    param($User, [string]$Disclosure, [string]$Title)
    $r = Invoke-Api -Method POST -Path "/api/posts" -Token $User.Token -Body @{
        title = $Title; content = "Engagement smoke ($Title)."; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25
        locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = $Disclosure
        locationPrecision = "ApproximateArea"
    }
    if ($r.Status -ne 201) { throw "Create $Disclosure post failed: HTTP $($r.Status) $($r.Raw)" }
    $id = $r.Json.id
    if (-not $id) { $id = $r.Json.postId }
    return $id
}

# Polls a GET until the predicate holds (projection is eventually consistent), at most ~15 s.
function Wait-For {
    param([string]$Path, [string]$Token, [scriptblock]$Until)
    $last = $null
    for ($i = 0; $i -lt 30; $i++) {
        $last = Invoke-Api -Method GET -Path $Path -Token $Token
        if ($last.Status -eq 200 -and (& $Until $last.Json)) { return $last }
        Start-Sleep -Milliseconds 500
    }
    return $last
}

Write-Host "BLK-ENGAGE-01 likes and comments via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$author = Register-SmokeUser -Label "author" -Suffix $suffix
$fan = Register-SmokeUser -Label "fan" -Suffix $suffix
$other = Register-SmokeUser -Label "other" -Suffix $suffix

$postId = New-Post -User $author -Disclosure "LimitedProfile" -Title "engage-$suffix"
Check "post created" ([bool]$postId)
$ready = Wait-For -Path "/api/posts/$postId" -Token $fan.Token -Until { param($j) $j.id -eq $postId }
Check "post projected" ($ready.Status -eq 200) "HTTP $($ready.Status)"

# --- Likes ---
$self = Invoke-Api -Method POST -Path "/api/posts/$postId/likes" -Token $author.Token
Check "author cannot like own post (400 CANNOT_LIKE_OWN)" ($self.Status -eq 400 -and $self.Json.code -eq "CANNOT_LIKE_OWN") "HTTP $($self.Status) $($self.Raw)"

$like = Invoke-Api -Method POST -Path "/api/posts/$postId/likes" -Token $fan.Token
Check "like answers liked=true" ($like.Status -eq 200 -and $like.Json.liked -eq $true) "HTTP $($like.Status) $($like.Raw)"
$afterLike = Wait-For -Path "/api/posts/$postId" -Token $fan.Token -Until { param($j) $j.likeCount -eq 1 -and $j.isLikedByCurrentUser }
Check "like counted once and visible to the liker" ($afterLike.Json.likeCount -eq 1 -and $afterLike.Json.isLikedByCurrentUser -eq $true) "count=$($afterLike.Json.likeCount) liked=$($afterLike.Json.isLikedByCurrentUser)"
$asOther = Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $other.Token
Check "someone else does not see it as liked by them" ($asOther.Json.likeCount -eq 1 -and $asOther.Json.isLikedByCurrentUser -eq $false) "liked=$($asOther.Json.isLikedByCurrentUser)"
$asGuest = Invoke-Api -Method GET -Path "/api/posts/$postId"
Check "a signed-out caller sees liked=false" ($asGuest.Status -eq 200 -and $asGuest.Json.isLikedByCurrentUser -eq $false)

$unlike = Invoke-Api -Method POST -Path "/api/posts/$postId/likes" -Token $fan.Token
Check "second press unlikes (liked=false)" ($unlike.Status -eq 200 -and $unlike.Json.liked -eq $false) "$($unlike.Raw)"
$afterUnlike = Wait-For -Path "/api/posts/$postId" -Token $fan.Token -Until { param($j) $j.likeCount -eq 0 -and -not $j.isLikedByCurrentUser }
Check "unlike brings the count back to 0" ($afterUnlike.Json.likeCount -eq 0 -and $afterUnlike.Json.isLikedByCurrentUser -eq $false) "count=$($afterUnlike.Json.likeCount)"

$missing = Invoke-Api -Method POST -Path "/api/posts/$([guid]::NewGuid())/likes" -Token $fan.Token
Check "liking a missing post is 404" ($missing.Status -eq 404) "HTTP $($missing.Status)"

# --- Comments ---
$empty = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $fan.Token -Body @{ commentText = "   " }
Check "empty comment is 400 COMMENT_EMPTY" ($empty.Status -eq 400 -and $empty.Json.code -eq "COMMENT_EMPTY") "HTTP $($empty.Status)"
$long = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $fan.Token -Body @{ commentText = ("x" * 501) }
Check "comment over 500 chars is 400 COMMENT_TOO_LONG" ($long.Status -eq 400 -and $long.Json.code -eq "COMMENT_TOO_LONG") "HTTP $($long.Status)"

$c1 = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $fan.Token -Body @{ commentText = "Sıra kısa mı?" }
Check "comment created" ($c1.Status -eq 200 -and $c1.Json.commentId) "HTTP $($c1.Status) $($c1.Raw)"
$c1Id = $c1.Json.commentId
$reply = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $author.Token -Body @{ commentText = "Evet, 2 kişi var."; parentCommentId = $c1Id }
Check "reply created" ($reply.Status -eq 200) "HTTP $($reply.Status) $($reply.Raw)"
$ghost = Invoke-Api -Method POST -Path "/api/posts/$([guid]::NewGuid())/comments" -Token $fan.Token -Body @{ commentText = "x" }
Check "commenting on a missing post is 404" ($ghost.Status -eq 404) "HTTP $($ghost.Status)"
$badParent =Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $fan.Token -Body @{ commentText = "x"; parentCommentId = [guid]::NewGuid() }
Check "reply to a missing comment is 404" ($badParent.Status -eq 404) "HTTP $($badParent.Status)"

$thread = Wait-For -Path "/api/posts/$postId/comments" -Token $fan.Token -Until { param($j) $j.commentCount -eq 2 }
Check "thread lists one top-level comment with one reply" ($thread.Json.totalCount -eq 1 -and $thread.Json.commentCount -eq 2 -and @($thread.Json.items[0].replies).Count -eq 1) "total=$($thread.Json.totalCount) count=$($thread.Json.commentCount)"
$top = $thread.Json.items[0]
Check "comment shows its author's name and is mine for the writer" ($top.authorName -eq $fan.UserName -and $top.isMine -eq $true -and $top.canDelete -eq $true) "name=$($top.authorName) mine=$($top.isMine)"
Check "reply is marked as the post author's" ($top.replies[0].isPostAuthor -eq $true -and $top.replies[0].authorId -eq $author.Id)
Check "comments response is not cacheable" (([string]$thread.Headers["Cache-Control"]) -match "no-store")
$detail = Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $other.Token
Check "post detail counts comments" ($detail.Json.commentCount -eq 2) "count=$($detail.Json.commentCount)"

$foreignDelete = Invoke-Api -Method DELETE -Path "/api/posts/$postId/comments/$c1Id" -Token $other.Token
Check "a stranger cannot delete a comment (403)" ($foreignDelete.Status -eq 403) "HTTP $($foreignDelete.Status)"
$ownerDelete = Invoke-Api -Method DELETE -Path "/api/posts/$postId/comments/$c1Id" -Token $author.Token
Check "post author can delete a comment (204)" ($ownerDelete.Status -eq 204) "HTTP $($ownerDelete.Status)"
$afterDelete = Wait-For -Path "/api/posts/$postId/comments" -Token $fan.Token -Until { param($j) $j.commentCount -eq 0 }
Check "deleting a comment removes its replies too" ($afterDelete.Json.commentCount -eq 0) "count=$($afterDelete.Json.commentCount)"

# --- Anonymous post: commenting must not reveal the author ---
$anonId = New-Post -User $author -Disclosure "AnonymousMap" -Title "engage-anon-$suffix"
$null = Wait-For -Path "/api/posts/$anonId" -Token $fan.Token -Until { param($j) $j.id -eq $anonId }
$anonComment = Invoke-Api -Method POST -Path "/api/posts/$anonId/comments" -Token $author.Token -Body @{ commentText = "Buradayım, sakin." }
Check "anonymous author can comment" ($anonComment.Status -eq 200) "HTTP $($anonComment.Status)"
$anonThread = Wait-For -Path "/api/posts/$anonId/comments" -Token $other.Token -Until { param($j) $j.commentCount -eq 1 }
$ac = $anonThread.Json.items[0]
Check "anonymous author's comment hides who they are" ($ac.isPostAuthor -eq $true -and $null -eq $ac.authorId -and $ac.authorName -ne $author.UserName -and -not $anonThread.Raw.Contains($author.Id) -and -not $anonThread.Raw.Contains($author.UserName)) "authorId=$($ac.authorId) name=$($ac.authorName)"

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-ENGAGE-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "`nPASS BLK-ENGAGE-01 likes and comments"
