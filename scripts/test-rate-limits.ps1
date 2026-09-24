param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-RATELIMIT-01 (SECURITY.md S3): after 10 failed sign-ins an account answers 429 TOO_MANY_ATTEMPTS (even with the
# right password) until the window passes; comments are limited per person (burst 20); chat messages too (60 a
# minute); other people are not affected by someone else's limit.

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
    $userName = "e2e_rl_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Email = "$userName@blinkr.local"; Token = $r.Json.token; Id = $r.Json.userId }
}

Write-Host "BLK-RATELIMIT-01 rate limits via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$victim = Register-SmokeUser -Label "victim" -Suffix $suffix
$other = Register-SmokeUser -Label "other" -Suffix $suffix
$talker = Register-SmokeUser -Label "talker" -Suffix $suffix

# 1. Password guessing on one account.
for ($i = 1; $i -le 10; $i++) { $null = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $victim.Email; password = "yanlis-sifre-$i" } }
$locked = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $victim.Email; password = "BlinkrSmoke!2026" }
Check "after 10 failures the account waits, even with the right password" ($locked.Status -eq 429 -and $locked.Json.code -eq "TOO_MANY_ATTEMPTS") "HTTP $($locked.Status) $($locked.Raw)"
$fine = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $other.Email; password = "BlinkrSmoke!2026" }
Check "another account signs in as usual" ($fine.Status -eq 200 -and $fine.Json.token)

# 2. Comments: a burst of 20, then 429.
$post = Invoke-Api -Method POST -Path "/api/posts" -Token $other.Token -Body @{
    title = ""; content = "Rate limit smoke."; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25
    locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea"
}
$postId = $post.Json.postId
for ($i = 0; $i -lt 30; $i++) { if ((Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $other.Token).Status -eq 200) { break }; Start-Sleep -Milliseconds 500 }
$statuses = @()
for ($i = 1; $i -le 24; $i++) { $statuses += (Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $talker.Token -Body @{ commentText = "Yorum $i" }).Status }
$ok = @($statuses | Where-Object { $_ -eq 200 }).Count
$limited = @($statuses | Where-Object { $_ -eq 429 }).Count
Check "comments: the first burst goes through, then 429" ($ok -ge 18 -and $ok -le 21 -and $limited -ge 3) "ok=$ok limited=$limited"
$ownComment = Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $other.Token -Body @{ commentText = "Benim yorumum" }
Check "someone else's limit does not block me" ($ownComment.Status -eq 200)

# 3. Chat: 60 a minute per person.
$conversation = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $talker.Token -Body @{ targetUserId = $other.Id }
$chatStatuses = @()
for ($i = 1; $i -le 63; $i++) { $chatStatuses += (Invoke-Api -Method POST -Path "/api/chat/conversations/$($conversation.Json.id)/messages" -Token $talker.Token -Body @{ text = "Mesaj $i" }).Status }
$chatOk = @($chatStatuses | Where-Object { $_ -eq 200 }).Count
$last = Invoke-Api -Method POST -Path "/api/chat/conversations/$($conversation.Json.id)/messages" -Token $talker.Token -Body @{ text = "Bir tane daha" }
Check "chat: at most 60 messages a minute" ($chatOk -eq 60 -and $last.Status -eq 429 -and $last.Json.code -eq "TOO_MANY_MESSAGES") "ok=$chatOk last=$($last.Status) $($last.Raw)"
$reply = Invoke-Api -Method POST -Path "/api/chat/conversations/$($conversation.Json.id)/messages" -Token $other.Token -Body @{ text = "Cevap" }
Check "the other person can still answer" ($reply.Status -eq 200)

if ($script:failures.Count -gt 0) { Write-Host "BLK-RATELIMIT-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-RATELIMIT-01 PASS"
