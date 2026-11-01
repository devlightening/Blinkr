param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-CHAT-03 (plan-devam Faz E): what the bubble chat needs from the server - "Görüldü" on my own messages only
# (with the read time), "yazıyor" through polling (a few seconds, never stored, ends when a message is sent),
# quoted replies (same conversation only) whose text disappears when the quoted message is taken back.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress -Depth 5)); $args.ContentType = "application/json; charset=utf-8" }
    $status = 0; $raw = ""
    try { $r = Invoke-WebRequest @args; $status = [int]$r.StatusCode; $raw = [string]$r.Content }
    catch {
        $resp = $_.Exception.Response
        if ($null -eq $resp) { throw }
        $status = [int]$resp.StatusCode
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $raw = $reader.ReadToEnd(); $reader.Dispose()
    }
    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) { try { $json = $raw | ConvertFrom-Json } catch { } }
    [pscustomobject]@{ Status = $status; Raw = $raw; Json = $json }
}
function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}
function Register-SmokeUser([string]$Label, [string]$Suffix) {
    $userName = "e2e_chat3_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}
function Messages([string]$ConversationId, [string]$Token) { Invoke-Api -Method GET -Path "/api/chat/conversations/$ConversationId/messages" -Token $Token }

Write-Host "BLK-CHAT-03 bubble chat data via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$a = Register-SmokeUser "a" $suffix
$b = Register-SmokeUser "b" $suffix
$c = Register-SmokeUser "c" $suffix
$conv = (Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $b.Id }).Json.id
$other = (Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $c.Token -Body @{ targetUserId = $b.Id }).Json.id

$hello = (Invoke-Api -Method POST -Path "/api/chat/conversations/$conv/messages" -Token $a.Token -Body @{ text = "Merhaba, kafe açık mı?" }).Json
$before = Messages $conv $a.Token
$mine = $before.Json.items | Where-Object { $_.id -eq $hello.id }
Check "my unread message is not seen yet" ($mine.seen -eq $false -and $null -eq $mine.seenAtUtc) "seen=$($mine.seen)"
$asB = Messages $conv $b.Token
$theirs = $asB.Json.items | Where-Object { $_.id -eq $hello.id }
Check "seen is never shown on someone else's message" ($theirs.seen -eq $false -and $null -eq $theirs.seenAtUtc)
Invoke-Api -Method POST -Path "/api/chat/conversations/$conv/read" -Token $b.Token | Out-Null
$after = (Messages $conv $a.Token).Json.items | Where-Object { $_.id -eq $hello.id }
Check "after reading, the sender sees 'Görüldü' with a time" ($after.seen -eq $true -and $null -ne $after.seenAtUtc) "seen=$($after.seen) at=$($after.seenAtUtc)"

$t = Invoke-Api -Method POST -Path "/api/chat/conversations/$conv/typing" -Token $a.Token
$typing = Messages $conv $b.Token
Check "typing shows on the other person's next poll" ($t.Status -eq 204 -and $typing.Json.otherTyping -eq $true) "HTTP $($t.Status) typing=$($typing.Json.otherTyping)"
Check "my own typing is not shown to me" ((Messages $conv $a.Token).Json.otherTyping -eq $false)
Invoke-Api -Method POST -Path "/api/chat/conversations/$conv/messages" -Token $a.Token -Body @{ text = "Az önce baktım" } | Out-Null
Check "sending a message ends typing" ((Messages $conv $b.Token).Json.otherTyping -eq $false)
$foreign = Invoke-Api -Method POST -Path "/api/chat/conversations/$conv/typing" -Token $c.Token
Check "typing in someone else's conversation is refused" ($foreign.Status -eq 403) "HTTP $($foreign.Status)"

$reply = Invoke-Api -Method POST -Path "/api/chat/conversations/$conv/messages" -Token $b.Token -Body @{ text = "Evet, açık"; replyToId = $hello.id }
Check "a reply carries a short quote of the message" ($reply.Status -eq 200 -and $reply.Json.replyTo.messageId -eq $hello.id -and $reply.Json.replyTo.text -eq "Merhaba, kafe açık mı?" -and $reply.Json.replyTo.senderId -eq $a.Id) $reply.Raw
$cross = Invoke-Api -Method POST -Path "/api/chat/conversations/$other/messages" -Token $c.Token -Body @{ text = "Bu olmamalı"; replyToId = $hello.id }
Check "a message from another conversation cannot be quoted" ($cross.Status -eq 400) "HTTP $($cross.Status)"
Invoke-Api -Method DELETE -Path "/api/chat/conversations/$conv/messages/$($hello.id)" -Token $a.Token | Out-Null
$quoted = (Messages $conv $b.Token).Json.items | Where-Object { $_.id -eq $reply.Json.id }
Check "taking a message back blanks its quotes too" ($quoted.replyTo.kind -eq "unsent" -and $quoted.replyTo.text -eq "") "kind=$($quoted.replyTo.kind) text=$($quoted.replyTo.text)"

if ($script:failures.Count -gt 0) { Write-Host "BLK-CHAT-03 FAILED: $($script:failures -join ', ')" -ForegroundColor Red; exit 1 }
Write-Host "BLK-CHAT-03 PASS"
