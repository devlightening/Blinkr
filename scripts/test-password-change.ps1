param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-PASSWORD-01 (Ayarlar > Hesap > Sifreyi degistir): the current password must be right; the new one follows the
# sign-up rules and must differ; a change signs out every other device (their refresh tokens stop working) while this
# device stays signed in; afterwards only the new password signs in.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress)); $args.ContentType = "application/json; charset=utf-8" }
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

Write-Host "BLK-PASSWORD-01 change password via $GatewayBaseUrl"
$name = "e2e_pw_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
$old = "BlinkrSmoke!2026"
$new = "YeniSifre!2026x"
$reg = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $name; email = "$name@blinkr.local"; password = $old }
if ($reg.Status -ne 200) { throw "register failed: HTTP $($reg.Status) $($reg.Raw)" }
$here = $reg.Json
$other = (Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = "$name@blinkr.local"; password = $old }).Json
Check "a second device is signed in" ($null -ne $other.refreshToken)

$wrong = Invoke-Api -Method POST -Path "/api/users/me/password" -Token $here.token -Body @{ currentPassword = "yanlis-sifre"; newPassword = $new; refreshToken = $here.refreshToken }
Check "a wrong current password is refused" ($wrong.Status -eq 400 -and $wrong.Json.code -eq "WRONG_PASSWORD") "HTTP $($wrong.Status) $($wrong.Raw)"
$short = Invoke-Api -Method POST -Path "/api/users/me/password" -Token $here.token -Body @{ currentPassword = $old; newPassword = "kisa"; refreshToken = $here.refreshToken }
Check "a short new password is refused" ($short.Status -eq 400 -and $short.Json.code -eq "PASSWORD_TOO_SHORT") "HTTP $($short.Status)"
$same = Invoke-Api -Method POST -Path "/api/users/me/password" -Token $here.token -Body @{ currentPassword = $old; newPassword = $old; refreshToken = $here.refreshToken }
Check "the same password is refused" ($same.Status -eq 400 -and $same.Json.code -eq "PASSWORD_UNCHANGED") "HTTP $($same.Status)"
$anon = Invoke-Api -Method POST -Path "/api/users/me/password" -Body @{ currentPassword = $old; newPassword = $new }
Check "signed-out callers cannot change a password" ($anon.Status -eq 401) "HTTP $($anon.Status)"

$ok = Invoke-Api -Method POST -Path "/api/users/me/password" -Token $here.token -Body @{ currentPassword = $old; newPassword = $new; refreshToken = $here.refreshToken }
Check "the password changes" ($ok.Status -eq 200 -and $ok.Json.changed -eq $true -and $ok.Json.sessionsEnded -ge 1) "HTTP $($ok.Status) $($ok.Raw)"
$otherRefresh = Invoke-Api -Method POST -Path "/api/auth/refresh" -Body @{ refreshToken = $other.refreshToken }
Check "the other device is signed out" ($otherRefresh.Status -eq 401) "HTTP $($otherRefresh.Status)"
$hereRefresh = Invoke-Api -Method POST -Path "/api/auth/refresh" -Body @{ refreshToken = $here.refreshToken }
Check "this device stays signed in" ($hereRefresh.Status -eq 200) "HTTP $($hereRefresh.Status) $($hereRefresh.Raw)"
$oldLogin = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = "$name@blinkr.local"; password = $old }
Check "the old password no longer signs in" ($oldLogin.Status -eq 401) "HTTP $($oldLogin.Status)"
$newLogin = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = "$name@blinkr.local"; password = $new }
Check "the new password signs in" ($newLogin.Status -eq 200) "HTTP $($newLogin.Status)"

if ($script:failures.Count -gt 0) { Write-Host "BLK-PASSWORD-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-PASSWORD-01 PASS"
