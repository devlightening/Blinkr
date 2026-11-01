param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-REALTIME-01 (V2-5, D-028): the SignalR hub through the Gateway. No token = refused; a chat message reaches the
# other person in under a second; typing goes only to the other person; read receipts reach the sender; a signal's
# room can be joined only for a signal the caller may read; comments, reactions and notifications arrive live; after
# LeavePost the room is quiet. The client side runs in Node with @microsoft/signalr (Expo's node_modules).

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]
$root = Split-Path -Parent $PSScriptRoot
$expo = Join-Path $root "src\Clients\Blinkr.Expo"

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
    $userName = "e2e_rt_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

Write-Host "BLK-REALTIME-01 realtime hub via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$a = Register-SmokeUser -Label "a" -Suffix $suffix
$b = Register-SmokeUser -Label "b" -Suffix $suffix

# Friends, so they may chat (adults may message anyone, but this keeps the test independent of that rule).
$null = Invoke-Api -Method POST -Path "/api/friends/requests" -Token $a.Token -Body @{ userId = $b.Id }
$null = Invoke-Api -Method POST -Path "/api/friends/requests/$($a.Id)/accept" -Token $b.Token
$conversation = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $b.Id }
Check "a conversation is opened" ($conversation.Status -eq 200 -and $conversation.Json.id) "HTTP $($conversation.Status) $($conversation.Raw)"

$post = Invoke-Api -Method POST -Path "/api/posts" -Token $b.Token -Body @{
    title = ""; content = "Realtime smoke."; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25
    locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea"
}
$postId = $post.Json.postId
Check "B shares a signal" ($post.Status -eq 201 -and $postId)
for ($i = 0; $i -lt 30; $i++) { if ((Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $a.Token).Status -eq 200) { break }; Start-Sleep -Milliseconds 500 }

$input = @{ tokenA = $a.Token; tokenB = $b.Token; userA = $a.Id; userB = $b.Id; conversationId = $conversation.Json.id; postId = $postId } | ConvertTo-Json -Compress
$inputFile = Join-Path $env:TEMP "blinkr-realtime-$suffix.json"
[IO.File]::WriteAllText($inputFile, $input)
Push-Location $expo
try { $line = (& node scripts/realtime-probe.cjs $GatewayBaseUrl $inputFile 2>&1 | Select-Object -Last 1) } finally { Pop-Location; Remove-Item $inputFile -ErrorAction SilentlyContinue }
$r = $line | ConvertFrom-Json
if ($r.error) { Write-Host "probe error: $($r.error)" -ForegroundColor Red }

Check "no token: the hub refuses the connection" ($r.noTokenRefused -eq $true)
Check "both people connect through the Gateway" ($r.connected -eq $true)
Check "a chat message reaches the other person in under a second" ($r.messageSent -eq $true -and $null -ne $r.messageMs -and $r.messageMs -lt 1000) "ms=$($r.messageMs)"
Check "typing reaches the other person" ($null -ne $r.typingMs)
Check "typing is not echoed to the typist" ($r.typingEchoedToSender -eq $false)
Check "the read receipt reaches the sender" ($null -ne $r.readMs)
Check "a readable signal's room can be joined" ($r.joinOwnPost -eq $true)
Check "an unknown signal's room cannot (quietly)" ($r.joinUnknownPost -eq $false -and $r.joinGarbage -eq $false)
Check "a new comment arrives live in the room" ($null -ne $r.commentMs) "ms=$($r.commentMs)"
Check "the notification arrives live" ($null -ne $r.notificationMs) "ms=$($r.notificationMs)"
Check "a reaction arrives live in the room" ($null -ne $r.reactionMs) "ms=$($r.reactionMs)"
Check "after LeavePost the room is quiet" ($r.heardAfterLeave -eq $false)
Check "after 60 join attempts in a minute even a real room is refused (S3)" ($r.joinAfterBurst -eq $false)

if ($script:failures.Count -gt 0) { Write-Host "BLK-REALTIME-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-REALTIME-01 PASS"
