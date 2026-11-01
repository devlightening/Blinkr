param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-STORY-LIKES-01 (V2-3): a follower can like a story once (idempotent), take it back; the author sees the count
# and a heart in the viewers and is told once; strangers and the author themselves cannot like.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body, [byte[]]$Raw, [string]$ContentType)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Compress -Depth 5); $args.ContentType = "application/json; charset=utf-8" }
    if ($null -ne $Raw) { $args.Body = $Raw; $args.ContentType = $ContentType }
    $status = 0; $text = ""; $bytes = $null
    try {
        $response = Invoke-WebRequest @args
        $status = [int]$response.StatusCode; $text = [string]$response.Content
        if ($response.RawContentStream) { $bytes = $response.RawContentStream.ToArray() }
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        $status = [int]$response.StatusCode
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream()); $text = $reader.ReadToEnd(); $reader.Dispose()
    }
    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($text)) { try { $json = $text | ConvertFrom-Json } catch { } }
    [pscustomobject]@{ Status = $status; Raw = $text; Json = $json; Bytes = $bytes }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

function Register-SmokeUser {
    param([string]$Label, [string]$Suffix)
    $userName = "e2e_story_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

Write-Host "BLK-STORY-LIKES-01 story likes via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$author = Register-SmokeUser -Label "lauthor" -Suffix $suffix
$fan = Register-SmokeUser -Label "lfan" -Suffix $suffix
$stranger = Register-SmokeUser -Label "lstranger" -Suffix $suffix
$null = Invoke-Api -Method POST -Path "/api/follows/$($author.Id)" -Token $fan.Token

$jpeg = [byte[]](0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x04, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x02, 0x11, 0x22, 0xFF, 0xD9)
$created = Invoke-Api -Method POST -Path "/api/stories?durationSeconds=5" -Token $author.Token -Raw $jpeg -ContentType "image/jpeg"
Check "author posts a story" ($created.Status -eq 200 -and $created.Json.id) "HTTP $($created.Status) $($created.Raw)"
$storyId = $created.Json.id

$like = Invoke-Api -Method POST -Path "/api/stories/$storyId/like" -Token $fan.Token
Check "a follower likes the story" ($like.Status -eq 200 -and $like.Json.liked -eq $true) "HTTP $($like.Status) $($like.Raw)"
$again = Invoke-Api -Method POST -Path "/api/stories/$storyId/like" -Token $fan.Token
Check "liking again is idempotent" ($again.Status -eq 200)
$fanList = Invoke-Api -Method GET -Path "/api/stories/users/$($author.Id)" -Token $fan.Token
Check "the follower sees likedByMe, not the count" ($fanList.Json[0].likedByMe -eq $true -and $null -eq $fanList.Json[0].likeCount) "$($fanList.Raw)"
$authorList = Invoke-Api -Method GET -Path "/api/stories/users/$($author.Id)" -Token $author.Token
Check "the author sees one like" ($authorList.Json[0].likeCount -eq 1) "$($authorList.Raw)"
$viewers = Invoke-Api -Method GET -Path "/api/stories/$storyId/viewers" -Token $author.Token
$fanRow = @($viewers.Json | Where-Object { $_.userId -eq $fan.Id })[0]
Check "a like counts as a view and shows a heart in the viewers" ($fanRow -and $fanRow.liked -eq $true) "$($viewers.Raw)"
Check "the author cannot like their own story" ((Invoke-Api -Method POST -Path "/api/stories/$storyId/like" -Token $author.Token).Status -eq 400)
Check "a stranger cannot like it (403)" ((Invoke-Api -Method POST -Path "/api/stories/$storyId/like" -Token $stranger.Token).Status -eq 403)

$notes = Invoke-Api -Method GET -Path "/api/notifications?limit=20" -Token $author.Token
$raw = [string]$notes.Raw
$count = ([regex]::Matches($raw, "hikayeni be")).Count
Check "the author is told once" ($notes.Status -eq 200 -and $count -eq 1) "HTTP $($notes.Status) count=$count"

$unlike = Invoke-Api -Method DELETE -Path "/api/stories/$storyId/like" -Token $fan.Token
Check "the follower takes the like back" ($unlike.Status -eq 200 -and $unlike.Json.liked -eq $false)
$after = Invoke-Api -Method GET -Path "/api/stories/users/$($author.Id)" -Token $author.Token
Check "the count drops to zero" ($after.Json[0].likeCount -eq 0)

$null = Invoke-Api -Method DELETE -Path "/api/stories/$storyId" -Token $author.Token

if ($script:failures.Count -gt 0) { Write-Host "BLK-STORY-LIKES-01 FAILED: $($script:failures -join ', ')" -ForegroundColor Red; exit 1 }
Write-Host "BLK-STORY-LIKES-01 PASS" -ForegroundColor Green
