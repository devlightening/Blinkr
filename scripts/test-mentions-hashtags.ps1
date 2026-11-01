param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-MENTIONS-01 (V2-4, D-027): @mentions are read from the text by the server and resolved (blocked people and
# unknown names are dropped, more than 10 names is 400), mentioned people are notified once (an anonymous signal does
# not say who), comments and signals carry the resolved mentions; #hashtags are folded (Turkish letters, case) and
# have a feed (newest first, never anonymous signals) and a prefix search.
# The script is ASCII (Windows PowerShell 5.1 reads it as ANSI): the Turkish tag is built from code points.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

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
    $userName = "e2e_men_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

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

function New-Signal {
    param($User, [string]$Content, [string]$Disclosure = "LimitedProfile")
    Invoke-Api -Method POST -Path "/api/posts" -Token $User.Token -Body @{
        title = ""; content = $Content; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25
        locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = $Disclosure; locationPrecision = "ApproximateArea"
    }
}

function Mentions-Of($user) {
    $notes = Invoke-Api -Method GET -Path "/api/notifications?limit=50" -Token $user.Token
    @($notes.Json.items | Where-Object { $_.type -eq "Mentioned" })
}

Write-Host "BLK-MENTIONS-01 mentions and hashtags via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$author = Register-SmokeUser -Label "author" -Suffix $suffix
$friend = Register-SmokeUser -Label "friend" -Suffix $suffix
$blocker = Register-SmokeUser -Label "blocker" -Suffix $suffix
$null = Invoke-Api -Method POST -Path "/api/blocks" -Token $blocker.Token -Body @{ userId = $author.Id }

# "#AkşamKahvesi<suffix>" with the Turkish s-cedilla, stored and searched as "aksamkahvesi<suffix>".
$sCedilla = [char]0x015F
$tagText = "Ak${sCedilla}amKahvesi$suffix"
$tag = "aksamkahvesi$suffix"

$post = New-Signal -User $author -Content "Bahcede masa var #$tagText @$($friend.UserName). mail a@$($friend.UserName).com @nobody_$suffix"
$postId = $post.Json.postId
Check "a signal with a tag and a mention is created" ($post.Status -eq 201 -and $postId) "HTTP $($post.Status) $($post.Raw)"
$detail = Wait-For -Path "/api/posts/$postId" -Token $friend.Token -Until { param($j) $j.id -eq $postId }
$mentioned = @($detail.Json.mentions)
Check "the signal carries exactly the resolved mention (trailing dot, e-mail and unknown name ignored)" ($mentioned.Count -eq 1 -and $mentioned[0].userId -eq $friend.Id -and $mentioned[0].userName -eq $friend.UserName) "$($detail.Raw)"
Check "the tag is stored folded" (@($detail.Json.hashtags) -contains $tag) "$($detail.Raw)"

$feed = Wait-For -Path "/api/discover/hashtag/$([uri]::EscapeDataString($tagText))" -Token $friend.Token -Until { param($j) @($j.items | Where-Object { $_.id -eq $postId }).Count -eq 1 }
Check "the tag feed finds it, whatever the letters and case" (@($feed.Json.items | Where-Object { $_.id -eq $postId }).Count -eq 1) "HTTP $($feed.Status) $($feed.Raw)"
$search = Invoke-Api -Method GET -Path "/api/discover/hashtags/search?q=AKSAMKAHVESI$suffix" -Token $friend.Token
Check "the tag search suggests it with a count" (@($search.Json | Where-Object { $_.tag -eq $tag -and $_.postCount -ge 1 }).Count -eq 1) "HTTP $($search.Status) $($search.Raw)"
Check "a one-letter tag is refused" ((Invoke-Api -Method GET -Path "/api/discover/hashtag/a" -Token $friend.Token).Status -eq 400)

Start-Sleep -Seconds 2
$friendNotes = Mentions-Of $friend
$fromSignal = @($friendNotes | Where-Object { $_.postId -eq $postId })
Check "the mentioned person is told once, by name" ($fromSignal.Count -eq 1 -and $fromSignal[0].actorUserId -eq $author.Id) "count=$($fromSignal.Count)"

# Comments: a mention of someone who blocked the writer is dropped; nobody is told.
$comment = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $author.Token -Body @{ commentText = "@$($friend.UserName) @$($blocker.UserName) bakin" }
Check "a comment with mentions is added" ($comment.Status -eq 200) "HTTP $($comment.Status) $($comment.Raw)"
$thread = Wait-For -Path "/api/posts/$postId/comments" -Token $friend.Token -Until { param($j) $j.commentCount -ge 1 }
$commentMentions = @($thread.Json.items[0].mentions)
Check "the comment links the friend but not the person who blocked the writer" ($commentMentions.Count -eq 1 -and $commentMentions[0].userId -eq $friend.Id) "$($thread.Raw)"
Start-Sleep -Seconds 2
Check "the friend is told about the comment mention" (@(Mentions-Of $friend | Where-Object { $_.body -like "*yorumda*" }).Count -eq 1)
Check "the person who blocked the writer is never told" ((Mentions-Of $blocker).Count -eq 0)

$many = (1..11 | ForEach-Object { "@someone${_}_$suffix" }) -join " "
$tooMany = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $author.Token -Body @{ commentText = $many }
Check "more than 10 names is refused" ($tooMany.Status -eq 400 -and $tooMany.Raw -match "TOO_MANY_MENTIONS") "HTTP $($tooMany.Status) $($tooMany.Raw)"

# An anonymous signal: the mention does not say who wrote it, and the tag feed leaves it out.
$anon = New-Signal -User $author -Content "Sessiz #$tagText @$($friend.UserName)" -Disclosure "AnonymousMap"
$anonId = $anon.Json.postId
Check "an anonymous signal is created" ($anon.Status -eq 201 -and $anonId)
$null = Wait-For -Path "/api/posts/$anonId" -Token $friend.Token -Until { param($j) $j.id -eq $anonId }
Start-Sleep -Seconds 2
$anonNote = @(Mentions-Of $friend | Where-Object { $_.postId -eq $anonId })
Check "the anonymous mention names nobody" ($anonNote.Count -eq 1 -and -not $anonNote[0].actorUserId -and -not ($anonNote[0].body -like "*$($author.UserName)*")) "$($anonNote | ConvertTo-Json -Compress)"
$feed2 = Invoke-Api -Method GET -Path "/api/discover/hashtag/$tag" -Token $friend.Token
Check "the tag feed never shows an anonymous signal" (@($feed2.Json.items | Where-Object { $_.id -eq $anonId }).Count -eq 0 -and @($feed2.Json.items | Where-Object { $_.id -eq $postId }).Count -eq 1)

if ($script:failures.Count -gt 0) { Write-Host "BLK-MENTIONS-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-MENTIONS-01 PASS"
