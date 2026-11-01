param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-ACTIVITY-01 (V2-7, D-029): reactions on one signal within an hour become one notification row ("a, b ve 1 kişi
# daha gönderine tepki verdi.") with the count and the newest faces; the same person again adds nothing; the row comes
# back as unread and to the top; another signal is its own row; a comment is never grouped; reading marks it read.

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
    $userName = "e2e_act_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

function New-Signal($User, [string]$Text) {
    $r = Invoke-Api -Method POST -Path "/api/posts" -Token $User.Token -Body @{
        title = ""; content = $Text; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25
        locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea"
    }
    $id = $r.Json.postId
    for ($i = 0; $i -lt 30; $i++) { if ((Invoke-Api -Method GET -Path "/api/posts/$id" -Token $User.Token).Status -eq 200) { break }; Start-Sleep -Milliseconds 500 }
    return $id
}

function Rows-For($User, [string]$PostId, [string]$Type) {
    $notes = Invoke-Api -Method GET -Path "/api/notifications?limit=50" -Token $User.Token
    @($notes.Json.items | Where-Object { $_.postId -eq $PostId -and $_.type -eq $Type })
}

function Wait-Rows($User, [string]$PostId, [string]$Type, [scriptblock]$Until) {
    $rows = @()
    for ($i = 0; $i -lt 20; $i++) { $rows = @(Rows-For $User $PostId $Type); if (& $Until $rows) { break }; Start-Sleep -Milliseconds 500 }
    return $rows
}

Write-Host "BLK-ACTIVITY-01 grouped notifications via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$owner = Register-SmokeUser -Label "owner" -Suffix $suffix
$a = Register-SmokeUser -Label "a" -Suffix $suffix
$b = Register-SmokeUser -Label "b" -Suffix $suffix
$c = Register-SmokeUser -Label "c" -Suffix $suffix

$post = New-Signal $owner "Activity smoke one"
$other = New-Signal $owner "Activity smoke two"
Check "two signals are shared" ([bool]$post -and [bool]$other)

$null = Invoke-Api -Method POST -Path "/api/posts/$post/likes" -Token $a.Token
$rows = @(Wait-Rows $owner $post "PostLiked" { param($r) $r.Count -ge 1 })
Check "the first like makes a row" ($rows.Count -eq 1 -and $rows[0].actorCount -eq 1 -and $rows[0].body -like "*$($a.UserName)*")

$null = Invoke-Api -Method POST -Path "/api/notifications/read" -Token $owner.Token -Body @{ notificationIds = @() }
$null = Invoke-Api -Method POST -Path "/api/posts/$post/likes" -Token $b.Token
$null = Invoke-Api -Method POST -Path "/api/posts/$post/likes" -Token $c.Token
$rows = @(Wait-Rows $owner $post "PostLiked" { param($r) $r.Count -eq 1 -and $r[0].actorCount -eq 3 })
Check "three people on one signal are one row with the count" ($rows.Count -eq 1 -and $rows[0].actorCount -eq 3) "$($rows | ConvertTo-Json -Compress)"
Check "the text names the newest two and counts the rest" ($rows[0].body -like "$($c.UserName), $($b.UserName) ve 1 ki*") "$($rows[0].body)"
Check "the newest two faces travel with it" (@($rows[0].actorIds).Count -eq 2 -and @($rows[0].actorIds) -contains $c.Id -and @($rows[0].actorIds) -contains $b.Id)
Check "the grown row is unread again" ($rows[0].isRead -eq $false)

# The same person again (unlike, like) adds nothing.
$null = Invoke-Api -Method POST -Path "/api/posts/$post/likes" -Token $a.Token
$null = Invoke-Api -Method POST -Path "/api/posts/$post/likes" -Token $a.Token
Start-Sleep -Seconds 2
$rows = @(Rows-For $owner $post "PostLiked")
Check "the same person again adds nothing" ($rows.Count -eq 1 -and $rows[0].actorCount -eq 3)

# Another signal is its own row; a comment is never grouped.
$null = Invoke-Api -Method POST -Path "/api/posts/$other/likes" -Token $a.Token
$otherRows = @(Wait-Rows $owner $other "PostLiked" { param($r) $r.Count -ge 1 })
Check "another signal gets its own row" ($otherRows.Count -eq 1 -and $otherRows[0].actorCount -eq 1)
$null = Invoke-Api -Method POST -Path "/api/posts/$post/comments" -Token $a.Token -Body @{ commentText = "Bir" }
$null = Invoke-Api -Method POST -Path "/api/posts/$post/comments" -Token $b.Token -Body @{ commentText = "Iki" }
$comments = @(Wait-Rows $owner $post "CommentCreated" { param($r) $r.Count -ge 2 })
Check "comments are never grouped" ($comments.Count -eq 2)

$unreadBefore = (Invoke-Api -Method GET -Path "/api/notifications/unread-count" -Token $owner.Token).Raw
$null = Invoke-Api -Method POST -Path "/api/notifications/read" -Token $owner.Token -Body @{ notificationIds = @() }
$unreadAfter = (Invoke-Api -Method GET -Path "/api/notifications/unread-count" -Token $owner.Token).Raw
Check "opening the list reads everything" ([int]($unreadBefore -replace '\D', '') -gt 0 -and [int]($unreadAfter -replace '\D', '') -eq 0) "before=$unreadBefore after=$unreadAfter"

if ($script:failures.Count -gt 0) { Write-Host "BLK-ACTIVITY-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-ACTIVITY-01 PASS"
