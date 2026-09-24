param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-REACTIONS-01 (V2-4, D-027): one emoji reaction per person (set, change, take back), counts on the aggregate and
# in the read model, not on your own signal, the old /likes toggle still works as the heart, a changed emoji tells
# the author nothing new; comment likes toggle (own comment too) and show likeCount / likedByMe per viewer.
# The script is ASCII (Windows PowerShell 5.1 reads it as ANSI): emojis are built from code points.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Emoji([int[]]$points) { ($points | ForEach-Object { [char]::ConvertFromUtf32($_) }) -join "" }
$HEART = Emoji 0x2764, 0xFE0F
$FIRE = Emoji 0x1F525
$LAUGH = Emoji 0x1F602

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
    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($text)) { try { $json = $text | ConvertFrom-Json } catch { } }
    [pscustomobject]@{ Status = $status; Raw = $text; Json = $json }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

function Register-SmokeUser {
    param([string]$Label, [string]$Suffix)
    $userName = "e2e_react_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

# Polls a GET until the predicate holds (the projection is eventually consistent), at most ~15 s.
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

function Count-Of($counts, [string]$emoji) {
    if ($null -eq $counts) { return 0 }
    $p = $counts.PSObject.Properties | Where-Object { $_.Name -eq $emoji }
    if ($p) { return [int]$p.Value } else { return 0 }
}

Write-Host "BLK-REACTIONS-01 reactions and comment likes via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$author = Register-SmokeUser -Label "author" -Suffix $suffix
$fan = Register-SmokeUser -Label "fan" -Suffix $suffix
$other = Register-SmokeUser -Label "other" -Suffix $suffix

$created = Invoke-Api -Method POST -Path "/api/posts" -Token $author.Token -Body @{
    title = "react-$suffix"; content = "Reaction smoke."; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25
    locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea"
}
$postId = $created.Json.postId
Check "signal created" ($created.Status -eq 201 -and $postId) "HTTP $($created.Status) $($created.Raw)"
$null = Wait-For -Path "/api/posts/$postId" -Token $fan.Token -Until { param($j) $j.id -eq $postId }

$r1 = Invoke-Api -Method POST -Path "/api/posts/$postId/reactions" -Token $fan.Token -Body @{ reaction = $FIRE }
Check "a reaction is set and counted at once" ($r1.Status -eq 200 -and $r1.Json.reaction -eq $FIRE -and (Count-Of $r1.Json.counts $FIRE) -eq 1) "HTTP $($r1.Status) $($r1.Raw)"
$r2 = Invoke-Api -Method POST -Path "/api/posts/$postId/reactions" -Token $fan.Token -Body @{ reaction = $LAUGH }
Check "changing the emoji replaces it (still one reaction)" ($r2.Status -eq 200 -and $r2.Json.reaction -eq $LAUGH -and (Count-Of $r2.Json.counts $LAUGH) -eq 1 -and (Count-Of $r2.Json.counts $FIRE) -eq 0) "$($r2.Raw)"
$read = Wait-For -Path "/api/posts/$postId" -Token $fan.Token -Until { param($j) (Count-Of $j.reactionCounts $LAUGH) -eq 1 }
Check "the read model shows the new emoji, one like, and mine" ($read.Json.likeCount -eq 1 -and $read.Json.myReaction -eq $LAUGH -and $read.Json.isLikedByCurrentUser -and (Count-Of $read.Json.reactionCounts $FIRE) -eq 0) "$($read.Raw)"
$authorView = Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $author.Token
Check "someone else sees the counts but not a reaction of their own" ($null -eq $authorView.Json.myReaction -and (Count-Of $authorView.Json.reactionCounts $LAUGH) -eq 1)

$r3 = Invoke-Api -Method POST -Path "/api/posts/$postId/reactions" -Token $fan.Token -Body @{ reaction = $LAUGH }
Check "the same emoji again takes it back" ($r3.Status -eq 200 -and $null -eq $r3.Json.reaction -and (Count-Of $r3.Json.counts $LAUGH) -eq 0) "$($r3.Raw)"
$gone = Wait-For -Path "/api/posts/$postId" -Token $fan.Token -Until { param($j) $j.likeCount -eq 0 }
Check "the read model counts zero again" ($gone.Json.likeCount -eq 0 -and $null -eq $gone.Json.myReaction) "$($gone.Raw)"

Check "an emoji outside the set is refused" ((Invoke-Api -Method POST -Path "/api/posts/$postId/reactions" -Token $fan.Token -Body @{ reaction = "x" }).Raw -match "INVALID_REACTION")
$own = Invoke-Api -Method POST -Path "/api/posts/$postId/reactions" -Token $author.Token -Body @{ reaction = $FIRE }
Check "no reaction on your own signal (400)" ($own.Status -eq 400 -and $own.Raw -match "CANNOT_LIKE_OWN") "HTTP $($own.Status) $($own.Raw)"

# The old heart toggle still works and is the heart reaction; a reaction on top of it replaces it.
$like = Invoke-Api -Method POST -Path "/api/posts/$postId/likes" -Token $other.Token
Check "the old /likes toggle still likes" ($like.Status -eq 200 -and $like.Json.liked -eq $true)
$hearted = Wait-For -Path "/api/posts/$postId" -Token $other.Token -Until { param($j) $j.myReaction -eq $HEART }
Check "an old-style like reads as the heart" ((Count-Of $hearted.Json.reactionCounts $HEART) -eq 1 -and $hearted.Json.likeCount -eq 1) "$($hearted.Raw)"
$swap = Invoke-Api -Method POST -Path "/api/posts/$postId/reactions" -Token $other.Token -Body @{ reaction = $FIRE }
$swapped = Wait-For -Path "/api/posts/$postId" -Token $other.Token -Until { param($j) $j.myReaction -eq $FIRE }
Check "a reaction replaces the heart without a second like" ($swap.Status -eq 200 -and $swapped.Json.likeCount -eq 1 -and (Count-Of $swapped.Json.reactionCounts $HEART) -eq 0) "$($swapped.Raw)"

# Notifications: the fan's first reaction told the author once; changing the emoji told nothing more.
Start-Sleep -Seconds 2
$notes = Invoke-Api -Method GET -Path "/api/notifications?limit=50" -Token $author.Token
# V2-7 (D-029): the fan's reaction and the other person's like on the same signal share one grouped row.
$likeRows = @($notes.Json.items | Where-Object { $_.type -eq "PostLiked" -and $_.postId -eq $postId })
Check "the author gets one grouped row for both people (the emoji change told nothing more)" ($likeRows.Count -eq 1 -and $likeRows[0].actorCount -eq 2) "count=$($likeRows.Count) $($notes.Raw)"

# Comment likes.
$c = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $other.Token -Body @{ commentText = "Guzel yer" }
$commentId = $c.Json.commentId
Check "a comment is added" ($c.Status -eq 200 -and $commentId)
$null = Wait-For -Path "/api/posts/$postId/comments" -Token $fan.Token -Until { param($j) $j.commentCount -eq 1 }
$cl = Invoke-Api -Method POST -Path "/api/posts/$postId/comments/$commentId/like" -Token $fan.Token
Check "a comment like answers liked + count" ($cl.Status -eq 200 -and $cl.Json.liked -eq $true -and $cl.Json.likeCount -eq 1) "$($cl.Raw)"
$ownLike = Invoke-Api -Method POST -Path "/api/posts/$postId/comments/$commentId/like" -Token $other.Token
Check "you may like your own comment" ($ownLike.Status -eq 200 -and $ownLike.Json.likeCount -eq 2) "$($ownLike.Raw)"
$fanThread = Wait-For -Path "/api/posts/$postId/comments" -Token $fan.Token -Until { param($j) $j.items[0].likeCount -eq 2 }
Check "the thread shows the count and my like" ($fanThread.Json.items[0].likeCount -eq 2 -and $fanThread.Json.items[0].likedByMe -eq $true) "$($fanThread.Raw)"
$authorThread = Invoke-Api -Method GET -Path "/api/posts/$postId/comments" -Token $author.Token
Check "another reader sees the count, not a like of theirs" ($authorThread.Json.items[0].likeCount -eq 2 -and $authorThread.Json.items[0].likedByMe -eq $false)
Check "the likers are never listed" (-not ($authorThread.Raw -match "likedBy`""))
$un = Invoke-Api -Method POST -Path "/api/posts/$postId/comments/$commentId/like" -Token $fan.Token
Check "a second tap takes the comment like back" ($un.Status -eq 200 -and $un.Json.liked -eq $false -and $un.Json.likeCount -eq 1)
$afterUn = Wait-For -Path "/api/posts/$postId/comments" -Token $fan.Token -Until { param($j) $j.items[0].likeCount -eq 1 }
Check "the thread follows" ($afterUn.Json.items[0].likedByMe -eq $false)
Check "an unknown comment is 404" ((Invoke-Api -Method POST -Path "/api/posts/$postId/comments/$([guid]::NewGuid())/like" -Token $fan.Token).Status -eq 404)

if ($script:failures.Count -gt 0) { Write-Host "BLK-REACTIONS-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-REACTIONS-01 PASS"
