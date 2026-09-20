param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-CHAT-01: 1:1 chat smoke through the Gateway (CLAUDE.md 6.5 / 13).
# Covers the happy path (search -> start -> send -> list -> read) and the
# failure contract: authorization, validation and no raw exception leakage.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Token,
        $Body
    )
    $args = @{
        UseBasicParsing = $true
        Uri = "$GatewayBaseUrl$Path"
        Method = $Method
        TimeoutSec = 20
        Headers = @{}
    }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) {
        $args.Body = ($Body | ConvertTo-Json -Compress)
        $args.ContentType = "application/json"
    }

    $status = 0
    $raw = ""
    try {
        $response = Invoke-WebRequest @args
        $status = [int]$response.StatusCode
        $raw = [string]$response.Content
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        $status = [int]$response.StatusCode
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $raw = $reader.ReadToEnd()
        $reader.Dispose()
    }

    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
        try { $json = $raw | ConvertFrom-Json } catch { }
    }
    [pscustomobject]@{ Status = $status; Raw = $raw; Json = $json }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) {
        Write-Host "PASS $Name"
    } else {
        Write-Host "FAIL $Name $Detail" -ForegroundColor Red
        $script:failures.Add($Name)
    }
}

function Leaks-Exception {
    param([string]$Raw)
    return ($Raw -match "System\.\w+Exception|   at [A-Z]\w+\.|StackTrace|Microsoft\.AspNetCore")
}

function New-SmokeUser {
    param([string]$Label, [string]$Suffix)
    $userName = "chat_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{
        userName = $userName
        email = "$userName@blinkr.local"
        password = "BlinkrSmoke!2026"
    }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $null }
}

Write-Host "BLK-CHAT-01 chat smoke via $GatewayBaseUrl"

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$a = New-SmokeUser -Label "a" -Suffix $suffix
$b = New-SmokeUser -Label "b" -Suffix $suffix
$c = New-SmokeUser -Label "c" -Suffix $suffix

# Resolve ids through the same search API the mobile client uses.
$s = Invoke-Api -Method GET -Path "/api/users/search?q=$($b.UserName)" -Token $a.Token
$b.Id = @($s.Json | ForEach-Object { $_ } | Where-Object { $_.userName -eq $b.UserName })[0].id
$s = Invoke-Api -Method GET -Path "/api/users/search?q=$($a.UserName)" -Token $b.Token
$a.Id = @($s.Json | ForEach-Object { $_ } | Where-Object { $_.userName -eq $a.UserName })[0].id
Check "user search finds target" ($null -ne $b.Id -and $null -ne $a.Id) "a=$($a.Id) b=$($b.Id)"

# Authentication
$r = Invoke-Api -Method GET -Path "/api/chat/conversations"
Check "unauthenticated list is 401" ($r.Status -eq 401) "HTTP $($r.Status)"

# Start / idempotent start
$r = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $b.Id }
Check "A starts conversation with B" ($r.Status -eq 200 -and $r.Json.id -and $r.Json.otherUserId -eq $b.Id) "HTTP $($r.Status)"
$conversationId = [string]$r.Json.id
$r2 = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $b.Token -Body @{ targetUserId = $a.Id }
Check "B starting with A returns the same conversation" ($r2.Status -eq 200 -and [string]$r2.Json.id -eq $conversationId) "HTTP $($r2.Status) id=$($r2.Json.id)"

$r = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $a.Id }
Check "conversation with self is a 4xx" ($r.Status -ge 400 -and $r.Status -lt 500) "HTTP $($r.Status)"
Check "conversation with self leaks no exception" (-not (Leaks-Exception $r.Raw))

# Send
$text = "merhaba $suffix"
$r = Invoke-Api -Method POST -Path "/api/chat/conversations/$conversationId/messages" -Token $a.Token -Body @{ text = $text }
Check "A sends message" ($r.Status -eq 200 -and $r.Json.text -eq $text -and $r.Json.senderId -eq $a.Id) "HTTP $($r.Status)"

$r = Invoke-Api -Method POST -Path "/api/chat/conversations/$conversationId/messages" -Token $a.Token -Body @{ text = "   " }
Check "empty message is a 4xx" ($r.Status -ge 400 -and $r.Status -lt 500) "HTTP $($r.Status)"
Check "empty message leaks no exception" (-not (Leaks-Exception $r.Raw))

# Receive
$r = Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $b.Token
$mine = @($r.Json.items | Where-Object { $_.id -eq $conversationId })
Check "B lists the conversation with preview" ($mine.Count -eq 1 -and $mine[0].lastMessagePreview -eq $text -and $mine[0].otherUserId -eq $a.Id) "HTTP $($r.Status)"
Check "B sees exactly one unread message" ($mine.Count -eq 1 -and $mine[0].unreadCount -eq 1) "unreadCount=$($mine[0].unreadCount)"
$rA = Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $a.Token
$senderSide = @($rA.Json.items | Where-Object { $_.id -eq $conversationId })
Check "sender's own message is not unread for the sender" ($senderSide.Count -eq 1 -and $senderSide[0].unreadCount -eq 0) "unreadCount=$($senderSide[0].unreadCount)"

$r = Invoke-Api -Method GET -Path "/api/chat/conversations/$conversationId/messages?limit=30" -Token $b.Token
$msgs = @($r.Json.items)
Check "B reads the message unread" ($r.Status -eq 200 -and $msgs.Count -eq 1 -and $msgs[0].isRead -eq $false) "HTTP $($r.Status) count=$($msgs.Count)"

$r = Invoke-Api -Method POST -Path "/api/chat/conversations/$conversationId/read" -Token $b.Token
Check "B marks read (204)" ($r.Status -eq 204) "HTTP $($r.Status)"
$rB2 = Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $b.Token
$afterRead = @($rB2.Json.items | Where-Object { $_.id -eq $conversationId })
Check "unread count drops to 0 after mark-read" ($afterRead.Count -eq 1 -and $afterRead[0].unreadCount -eq 0) "unreadCount=$($afterRead[0].unreadCount)"
$r = Invoke-Api -Method GET -Path "/api/chat/conversations/$conversationId/messages" -Token $b.Token
Check "message is read after mark-read" (@($r.Json.items)[0].isRead -eq $true)

# Authorization: a non-participant must be refused without leaking internals.
$r = Invoke-Api -Method GET -Path "/api/chat/conversations/$conversationId/messages" -Token $c.Token
Check "outsider read is 403" ($r.Status -eq 403) "HTTP $($r.Status)"
Check "outsider read leaks no exception" (-not (Leaks-Exception $r.Raw))
$r = Invoke-Api -Method POST -Path "/api/chat/conversations/$conversationId/messages" -Token $c.Token -Body @{ text = "intruder" }
Check "outsider send is 403" ($r.Status -eq 403) "HTTP $($r.Status)"
$r = Invoke-Api -Method POST -Path "/api/chat/conversations/$conversationId/read" -Token $c.Token
Check "outsider mark-read is 403" ($r.Status -eq 403) "HTTP $($r.Status)"

# Unknown conversation
$r = Invoke-Api -Method GET -Path "/api/chat/conversations/000000000000000000000000/messages" -Token $a.Token
Check "unknown conversation is 404" ($r.Status -eq 404) "HTTP $($r.Status)"
Check "unknown conversation leaks no exception" (-not (Leaks-Exception $r.Raw))

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-CHAT-01 chat smoke: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "`nPASS BLK-CHAT-01 chat smoke"
Write-Host "ConversationId: $conversationId"
