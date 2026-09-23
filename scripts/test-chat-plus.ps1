param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-CHAT-02 (sinyal-mvp-plan Faz 8): a retried message with the same client id is sent once; a signal can be shared
# into a chat (link + snapshot, never its author); reactions are one per person from a fixed set; only the sender can
# take a message back and its content is gone for both.

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
    $userName = "chat2_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

Write-Host "BLK-CHAT-02 chat extras via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$a = Register-SmokeUser -Label "a" -Suffix $suffix
$b = Register-SmokeUser -Label "b" -Suffix $suffix
$conv = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $b.Id }
$cid = $conv.Json.id
$path = "/api/chat/conversations/$cid/messages"
# Emoji built from code points: Windows PowerShell 5 reads a BOM-less script as ANSI and would garble literals.
$heart = [char]::ConvertFromUtf32(0x2764) + [char]0xFE0F
$laugh = [char]::ConvertFromUtf32(0x1F602)
$thumbs = [char]::ConvertFromUtf32(0x1F44D)
$poo = [char]::ConvertFromUtf32(0x1F4A9)

$first = Invoke-Api -Method POST -Path $path -Token $a.Token -Body @{ text = "Merhaba"; clientId = "c-$suffix" }
$retry = Invoke-Api -Method POST -Path $path -Token $a.Token -Body @{ text = "Merhaba"; clientId = "c-$suffix" }
$list = Invoke-Api -Method GET -Path $path -Token $b.Token
Check "a retried send with the same client id creates one message" ($first.Json.id -eq $retry.Json.id -and @($list.Json.items).Count -eq 1) "count=$(@($list.Json.items).Count)"

$postId = [guid]::NewGuid()
$share = Invoke-Api -Method POST -Path $path -Token $a.Token -Body @{ text = ""; signal = @{ postId = "$postId"; signalType = "Queue"; signalValue = "Over15"; title = "Eczane kuyruğu"; locationName = "Kent Eczanesi" } }
Check "a signal can be shared into the chat" ($share.Status -eq 200 -and $share.Json.kind -eq "signal" -and $share.Json.signal.postId -eq "$postId") "HTTP $($share.Status) $($share.Raw)"
$seen = Invoke-Api -Method GET -Path $path -Token $b.Token
$shared = @($seen.Json.items | Where-Object { $_.kind -eq "signal" })[0]
Check "the recipient sees the shared signal (no author in it)" ($shared.signal.title -eq "Eczane kuyruğu" -and -not ($seen.Raw -match 'authorName|authorId'))
$convs = Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $b.Token
Check "the conversation list says a signal was shared" (@($convs.Json.items | Where-Object { $_.id -eq $cid })[0].lastMessageKind -eq "signal")
$emptyBoth = Invoke-Api -Method POST -Path $path -Token $a.Token -Body @{ text = "   " }
Check "an empty message is still refused (400)" ($emptyBoth.Status -eq 400)

$react = Invoke-Api -Method PUT -Path "$path/$($first.Json.id)/reaction" -Token $b.Token -Body @{ emoji = $heart }
Check "the recipient reacts with a heart" ($react.Status -eq 200 -and @($react.Json.reactions).Count -eq 1 -and $react.Json.reactions[0].emoji -eq $heart) "HTTP $($react.Status) $($react.Raw)"
$again = Invoke-Api -Method PUT -Path "$path/$($first.Json.id)/reaction" -Token $b.Token -Body @{ emoji = $laugh }
Check "one reaction per person (the new one replaces)" (@($again.Json.reactions).Count -eq 1 -and $again.Json.reactions[0].emoji -eq $laugh)
$bad = Invoke-Api -Method PUT -Path "$path/$($first.Json.id)/reaction" -Token $b.Token -Body @{ emoji = $poo }
Check "only the fixed reactions are allowed (400)" ($bad.Status -eq 400)
$clear = Invoke-Api -Method PUT -Path "$path/$($first.Json.id)/reaction" -Token $b.Token -Body @{ emoji = $null }
Check "a reaction can be cleared" (@($clear.Json.reactions).Count -eq 0)

$foreign = Invoke-Api -Method DELETE -Path "$path/$($first.Json.id)" -Token $b.Token
Check "only the sender can take a message back (403)" ($foreign.Status -eq 403)
$unsend = Invoke-Api -Method DELETE -Path "$path/$($share.Json.id)" -Token $a.Token
Check "the sender takes the shared signal back" ($unsend.Status -eq 200 -and $unsend.Json.kind -eq "unsent" -and $null -eq $unsend.Json.signal)
$after = Invoke-Api -Method GET -Path $path -Token $b.Token
Check "its content is gone for the recipient too" (-not $after.Raw.Contains("Eczane kuyruğu") -and -not $after.Raw.Contains("$postId"))
$reactUnsent = Invoke-Api -Method PUT -Path "$path/$($share.Json.id)/reaction" -Token $b.Token -Body @{ emoji = $thumbs }
Check "a taken-back message cannot get reactions (400)" ($reactUnsent.Status -eq 400)

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-CHAT-02: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    exit 1
}
Write-Host "`nPASS BLK-CHAT-02 chat extras"
