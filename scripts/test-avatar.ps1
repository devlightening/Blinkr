param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-AVATAR-01: users pick an avatar from a fixed server-owned catalogue (never an uploaded photo); the choice
# is returned at login, by user lookup and by search, and arbitrary strings are rejected.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [string]$Token)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30 }
    if ($Token) { $args.Headers = @{ Authorization = "Bearer $Token" } }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Compress); $args.ContentType = "application/json" }
    $status = 0; $raw = ""
    try { $response = Invoke-WebRequest @args; $status = [int]$response.StatusCode; $raw = [string]$response.Content }
    catch {
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

Write-Host "BLK-AVATAR-01 avatar catalogue via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$name = "avatar_$suffix"
$email = "$name@blinkr.local"
$password = "BlinkrSmoke!2026"

$reg = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $name; email = $email; password = $password }
Check "registration succeeds and starts without an avatar" ($reg.Status -eq 200 -and -not $reg.Json.avatarKey) "HTTP $($reg.Status) $($reg.Raw)"
$token = $reg.Json.token
$userId = $reg.Json.userId

$unauth = Invoke-Api -Method PUT -Path "/api/users/me/avatar" -Body @{ avatarKey = "123" }
Check "choosing an avatar needs a signed-in user" ($unauth.Status -eq 401) "HTTP $($unauth.Status)"

$set = Invoke-Api -Method PUT -Path "/api/users/me/avatar" -Body @{ avatarKey = "253" } -Token $token
Check "a catalogue key is accepted" ($set.Status -eq 200 -and $set.Json.avatarKey -eq "253") "HTTP $($set.Status) $($set.Raw)"

$login = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $email; password = $password }
Check "login returns the chosen avatar" ($login.Status -eq 200 -and $login.Json.avatarKey -eq "253") "HTTP $($login.Status) $($login.Raw)"

$lookup = Invoke-Api -Method GET -Path "/api/users/$userId" -Token $token
Check "user lookup returns the avatar" ($lookup.Status -eq 200 -and $lookup.Json.avatarKey -eq "253") "HTTP $($lookup.Status) $($lookup.Raw)"

$search = Invoke-Api -Method GET -Path "/api/users/search?q=$name" -Token $token
$found = @($search.Json) | Where-Object { $_.id -eq $userId } | Select-Object -First 1
Check "search returns the avatar" ($search.Status -eq 200 -and $found -and $found.avatarKey -eq "253") "HTTP $($search.Status) $($search.Raw)"

foreach ($bad in @("999", "abc", "25", "2533", "8 3", "<script>")) {
    $r = Invoke-Api -Method PUT -Path "/api/users/me/avatar" -Body @{ avatarKey = $bad } -Token $token
    Check "invalid key '$bad' is a 400 INVALID_AVATAR" ($r.Status -eq 400 -and $r.Json.error -eq "INVALID_AVATAR") "HTTP $($r.Status) $($r.Raw)"
}
$after = Invoke-Api -Method GET -Path "/api/users/$userId" -Token $token
Check "rejected keys do not change the stored avatar" ($after.Json.avatarKey -eq "253")

$clear = Invoke-Api -Method PUT -Path "/api/users/me/avatar" -Body @{ avatarKey = $null } -Token $token
Check "null clears the avatar back to the default" ($clear.Status -eq 200 -and -not $clear.Json.avatarKey) "HTTP $($clear.Status) $($clear.Raw)"
$cleared = Invoke-Api -Method GET -Path "/api/users/$userId" -Token $token
Check "the cleared avatar stays cleared" (-not $cleared.Json.avatarKey)

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-AVATAR-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "`nPASS BLK-AVATAR-01 avatar catalogue"
