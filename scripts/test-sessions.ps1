param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-SESSIONS-01 (SECURITY.md S6): each sign-in is a session; "sign out of other devices" ends every session but the
# caller's; a rotated refresh token used again within a minute is only refused (a lost response), but used again after
# that it ends every session of the person (someone else holds a copy).

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

function Refresh-With([string]$RefreshToken) { Invoke-Api -Method POST -Path "/api/auth/refresh" -Body @{ refreshToken = $RefreshToken } }

Write-Host "BLK-SESSIONS-01 sessions via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$userName = "e2e_sess_$suffix"; $email = "$userName@blinkr.local"; $password = "BlinkrSmoke!2026"
$first = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = $email; password = $password }
$second = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $email; password = $password }
$third = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $email; password = $password }
Check "three sign-ins" ($first.Json.refreshToken -and $second.Json.refreshToken -and $third.Json.refreshToken)

$list = Invoke-Api -Method GET -Path "/api/users/me/sessions" -Token $third.Json.token
Check "three sessions are listed" ($list.Status -eq 200 -and $list.Json.count -eq 3) "$($list.Raw)"

$revoke = Invoke-Api -Method POST -Path "/api/users/me/sessions/revoke-others" -Token $third.Json.token -Body @{ refreshToken = $third.Json.refreshToken }
Check "signing out of the other devices ends two" ($revoke.Status -eq 200 -and $revoke.Json.revoked -eq 2) "$($revoke.Raw)"
Check "one session is left" ((Invoke-Api -Method GET -Path "/api/users/me/sessions" -Token $third.Json.token).Json.count -eq 1)
Check "another device can no longer refresh" ((Refresh-With $first.Json.refreshToken).Status -eq 401)
Check "an unknown refresh token cannot be kept" ((Invoke-Api -Method POST -Path "/api/users/me/sessions/revoke-others" -Token $third.Json.token -Body @{ refreshToken = "not-a-token" }).Status -eq 400)

# Rotation and reuse.
$r4 = Refresh-With $third.Json.refreshToken
Check "this device refreshes (rotation)" ($r4.Status -eq 200 -and $r4.Json.refreshToken)
Check "the old token again at once is only refused" ((Refresh-With $third.Json.refreshToken).Status -eq 401)
$r5 = Refresh-With $r4.Json.refreshToken
Check "the session goes on with the new token" ($r5.Status -eq 200 -and $r5.Json.refreshToken)
Write-Host "... waiting 62 s for the reuse grace to pass"
Start-Sleep -Seconds 62
Check "a rotated token used again later is refused" ((Refresh-With $r4.Json.refreshToken).Status -eq 401)
Check "and it ended every session of the person" ((Refresh-With $r5.Json.refreshToken).Status -eq 401)
$again = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $email; password = $password }
Check "signing in again works" ($again.Status -eq 200)

if ($script:failures.Count -gt 0) { Write-Host "BLK-SESSIONS-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-SESSIONS-01 PASS"
