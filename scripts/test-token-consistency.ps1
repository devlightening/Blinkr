param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-TOKENS-01 (CLAUDE.md §14, §21 P1): every service accepts an access token under exactly the same rules. A real
# token is re-signed in variants with the Development-only key (BlinkrJwtOptions.DevelopmentOnlySigningKey, refused
# outside Development) and sent to Identity, Blog, Place and Notifications: the unchanged token is accepted; a wrong
# audience, wrong issuer, expired token, wrong key, "alg: none", a tampered payload and a refresh token used as an
# access token are all refused with 401. Development only.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]
$devKey = "blinkr-development-only-signing-key-change-for-production-2026"

function B64Url([byte[]]$bytes) { [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
function FromB64Url([string]$s) { $p = $s.Replace('-', '+').Replace('_', '/'); switch ($p.Length % 4) { 2 { $p += '==' } 3 { $p += '=' } }; [Convert]::FromBase64String($p) }
function Sign([string]$HeaderJson, [string]$PayloadJson, [string]$Key) {
    $h = B64Url ([Text.Encoding]::UTF8.GetBytes($HeaderJson)); $p = B64Url ([Text.Encoding]::UTF8.GetBytes($PayloadJson))
    $hmac = New-Object System.Security.Cryptography.HMACSHA256 (,[Text.Encoding]::UTF8.GetBytes($Key))
    "$h.$p." + (B64Url $hmac.ComputeHash([Text.Encoding]::ASCII.GetBytes("$h.$p")))
}
function Payload([string]$Token) { [Text.Encoding]::UTF8.GetString((FromB64Url $Token.Split('.')[1])) | ConvertFrom-Json }
function With($Payload, [hashtable]$Changes) {
    $copy = $Payload | ConvertTo-Json -Depth 5 | ConvertFrom-Json
    foreach ($k in $Changes.Keys) { $copy | Add-Member -NotePropertyName $k -NotePropertyValue $Changes[$k] -Force }
    $copy | ConvertTo-Json -Compress -Depth 5
}

function Status([string]$Method, [string]$Path, [string]$Token) {
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{ Authorization = "Bearer $Token" } }
    if ($Method -eq "POST") { $args.Body = "{}"; $args.ContentType = "application/json" }
    try { [int](Invoke-WebRequest @args).StatusCode } catch { if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { throw } }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

Write-Host "BLK-TOKENS-01 token rules across services via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$userName = "e2e_tok_$suffix"
$reg = Invoke-RestMethod -Method Post -Uri "$GatewayBaseUrl/api/auth/register" -ContentType "application/json" -Body (@{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" } | ConvertTo-Json)
$payload = Payload $reg.token
$header = '{"alg":"HS256","typ":"JWT"}'
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

$endpoints = @(
    @{ Name = "Identity"; Method = "GET"; Path = "/api/users/me" },
    @{ Name = "Blog"; Method = "GET"; Path = "/api/discover/following" },
    @{ Name = "Place"; Method = "POST"; Path = "/api/places" },
    @{ Name = "Notifications"; Method = "GET"; Path = "/api/notifications/unread-count" }
)

$resigned = Sign $header ($payload | ConvertTo-Json -Compress -Depth 5) $devKey
$variants = [ordered]@{
    "wrong audience" = Sign $header (With $payload @{ aud = "someone.else" }) $devKey
    "wrong issuer" = Sign $header (With $payload @{ iss = "Not.Blinkr" }) $devKey
    "expired" = Sign $header (With $payload @{ exp = $now - 600; nbf = $now - 1200; iat = $now - 1200 }) $devKey
    "wrong key" = Sign $header ($payload | ConvertTo-Json -Compress -Depth 5) "another-key-that-is-long-enough-for-hmac-sha256-2026"
    "alg none" = (B64Url ([Text.Encoding]::UTF8.GetBytes('{"alg":"none","typ":"JWT"}'))) + "." + (B64Url ([Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress -Depth 5)))) + "."
    "tampered payload" = ($reg.token.Split('.')[0]) + "." + (B64Url ([Text.Encoding]::UTF8.GetBytes((With $payload @{ role = "Admin" })))) + "." + ($reg.token.Split('.')[2])
    "refresh token as access token" = $reg.refreshToken
}

foreach ($e in $endpoints) {
    $real = Status $e.Method $e.Path $reg.token
    $again = Status $e.Method $e.Path $resigned
    Check "$($e.Name): the real token is accepted" ($real -ne 401) "HTTP $real"
    Check "$($e.Name): the same claims re-signed with the dev key are accepted (the test signs like the services check)" ($again -ne 401) "HTTP $again"
    foreach ($v in $variants.Keys) {
        $code = Status $e.Method $e.Path $variants[$v]
        Check "$($e.Name): $v is refused" ($code -eq 401) "HTTP $code"
    }
}

if ($script:failures.Count -gt 0) { Write-Host "BLK-TOKENS-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-TOKENS-01 PASS"
