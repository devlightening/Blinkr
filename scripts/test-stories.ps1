param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-STORIES-01 (sinyal-mvp-plan Faz 7): a story is seen by its author and accepted followers only; the tray shows
# unseen first; seen state and viewers are tracked; photos lose EXIF; the author can delete; blocked people and
# non-followers get nothing.

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
    $userName = "story_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

Write-Host "BLK-STORIES-01 stories via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$author = Register-SmokeUser -Label "author" -Suffix $suffix
$fan = Register-SmokeUser -Label "fan" -Suffix $suffix
$stranger = Register-SmokeUser -Label "stranger" -Suffix $suffix
$null = Invoke-Api -Method POST -Path "/api/follows/$($author.Id)" -Token $fan.Token

$gps = [System.Text.Encoding]::ASCII.GetBytes("GPSLatitude=39.9")
$payload = [System.Text.Encoding]::ASCII.GetBytes("Exif") + [byte[]](0, 0) + $gps
$len = $payload.Length + 2
$jpeg = [byte[]](0xFF, 0xD8, 0xFF, 0xE1, [byte]($len -shr 8), [byte]($len -band 0xFF)) + $payload + [byte[]](0xFF, 0xDA, 0x00, 0x02, 0x11, 0x22, 0xFF, 0xD9)

$bad = Invoke-Api -Method POST -Path "/api/stories?durationSeconds=7" -Token $author.Token -Raw $jpeg -ContentType "image/jpeg"
Check "a photo story needs 3, 5 or 10 seconds" ($bad.Status -eq 400 -and $bad.Json.code -eq "INVALID_DURATION")
$fake = Invoke-Api -Method POST -Path "/api/stories?durationSeconds=5" -Token $author.Token -Raw ([System.Text.Encoding]::ASCII.GetBytes("not an image")) -ContentType "image/jpeg"
Check "bytes that are not the declared type are refused" ($fake.Status -eq 400)
$created = Invoke-Api -Method POST -Path "/api/stories?durationSeconds=5&caption=Kuyruk" -Token $author.Token -Raw $jpeg -ContentType "image/jpeg"
Check "author posts a story" ($created.Status -eq 200 -and $created.Json.id) "HTTP $($created.Status) $($created.Raw)"
$storyId = $created.Json.id

$trayFan = Invoke-Api -Method GET -Path "/api/stories/tray" -Token $fan.Token
$entry = @($trayFan.Json | Where-Object { $_.authorId -eq $author.Id })[0]
Check "a follower sees it in the tray, unseen" ($entry -and $entry.allSeen -eq $false -and $entry.storyCount -eq 1) "$($trayFan.Raw)"
$trayStranger = Invoke-Api -Method GET -Path "/api/stories/tray" -Token $stranger.Token
Check "a stranger's tray does not have it" (@($trayStranger.Json | Where-Object { $_.authorId -eq $author.Id }).Count -eq 0)
$list = Invoke-Api -Method GET -Path "/api/stories/users/$($author.Id)" -Token $fan.Token
Check "follower lists the stories" ($list.Status -eq 200 -and @($list.Json).Count -eq 1 -and $null -eq $list.Json[0].viewerCount)
Check "stranger cannot list them (403)" ((Invoke-Api -Method GET -Path "/api/stories/users/$($author.Id)" -Token $stranger.Token).Status -eq 403)
Check "stranger cannot fetch the media (403)" ((Invoke-Api -Method GET -Path "/api/stories/$storyId/content" -Token $stranger.Token).Status -eq 403)

$content = Invoke-Api -Method GET -Path "/api/stories/$storyId/content" -Token $fan.Token
$asText = [System.Text.Encoding]::ASCII.GetString($content.Bytes)
Check "follower fetches the media without EXIF/GPS" ($content.Status -eq 200 -and -not $asText.Contains("GPSLatitude") -and -not $asText.Contains("Exif")) "HTTP $($content.Status)"

$seen = Invoke-Api -Method POST -Path "/api/stories/$storyId/seen" -Token $fan.Token
$null = Invoke-Api -Method POST -Path "/api/stories/$storyId/seen" -Token $fan.Token
$trayAfter = Invoke-Api -Method GET -Path "/api/stories/tray" -Token $fan.Token
Check "after watching, the tray marks it seen" ($seen.Status -eq 204 -and @($trayAfter.Json | Where-Object { $_.authorId -eq $author.Id })[0].allSeen -eq $true)
$viewers = Invoke-Api -Method GET -Path "/api/stories/$storyId/viewers" -Token $author.Token
Check "author sees one viewer (seen twice counts once)" (@($viewers.Json).Count -eq 1 -and $viewers.Json[0].userId -eq $fan.Id)
Check "only the author may list viewers (403)" ((Invoke-Api -Method GET -Path "/api/stories/$storyId/viewers" -Token $fan.Token).Status -eq 403)
$own = Invoke-Api -Method GET -Path "/api/stories/users/$($author.Id)" -Token $author.Token
Check "author's own list shows the viewer count" ($own.Json[0].viewerCount -eq 1)

$null = Invoke-Api -Method POST -Path "/api/blocks" -Token $author.Token -Body @{ userId = $fan.Id }
Check "after a block the follower sees nothing (403)" ((Invoke-Api -Method GET -Path "/api/stories/users/$($author.Id)" -Token $fan.Token).Status -eq 403)

Check "a stranger cannot delete it (403)" ((Invoke-Api -Method DELETE -Path "/api/stories/$storyId" -Token $stranger.Token).Status -eq 403)
$del = Invoke-Api -Method DELETE -Path "/api/stories/$storyId" -Token $author.Token
$gone = Invoke-Api -Method GET -Path "/api/stories/$storyId/content" -Token $author.Token
Check "author deletes it and the media is gone" ($del.Status -eq 204 -and $gone.Status -eq 410)

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-STORIES-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    exit 1
}
Write-Host "`nPASS BLK-STORIES-01 stories"
