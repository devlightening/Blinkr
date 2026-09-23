param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-AUTH-02: registration keeps usernames and e-mails unique regardless of case, validates its
# input with stable error codes, and login does not depend on the case of the e-mail.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30 }
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

function Register { param($UserName, $Email, $Password = "BlinkrSmoke!2026") Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $UserName; email = $Email; password = $Password } }

Write-Host "BLK-AUTH-02 registration rules via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$name = "e2e_reg_user_$suffix"
$email = "reg_user_$suffix@blinkr.local"

$first = Register -UserName $name -Email $email
Check "first registration succeeds" ($first.Status -eq 200 -and $first.Json.token -and $first.Json.userName -eq $name) "HTTP $($first.Status) $($first.Raw)"

$sameName = Register -UserName $name -Email "other_$suffix@blinkr.local"
Check "same username is a 409 USERNAME_TAKEN" ($sameName.Status -eq 409 -and $sameName.Json.error -eq "USERNAME_TAKEN") "HTTP $($sameName.Status) $($sameName.Raw)"
Check "the error has a message for the user" (-not [string]::IsNullOrWhiteSpace($sameName.Json.message))

$otherCaseName = Register -UserName $name.ToUpperInvariant() -Email "third_$suffix@blinkr.local"
Check "username differing only by case is a 409" ($otherCaseName.Status -eq 409 -and $otherCaseName.Json.error -eq "USERNAME_TAKEN") "HTTP $($otherCaseName.Status)"

$otherCaseEmail = Register -UserName "reg_other_$suffix" -Email $email.ToUpperInvariant()
Check "e-mail differing only by case is a 409 EMAIL_TAKEN" ($otherCaseEmail.Status -eq 409 -and $otherCaseEmail.Json.error -eq "EMAIL_TAKEN") "HTTP $($otherCaseEmail.Status) $($otherCaseEmail.Raw)"

$short = Register -UserName "ab" -Email "short_$suffix@blinkr.local"
Check "a 2-character username is a 400 INVALID_USERNAME" ($short.Status -eq 400 -and $short.Json.error -eq "INVALID_USERNAME") "HTTP $($short.Status)"
$spaces = Register -UserName "has spaces $suffix" -Email "spaces_$suffix@blinkr.local"
Check "a username with spaces is a 400 INVALID_USERNAME" ($spaces.Status -eq 400 -and $spaces.Json.error -eq "INVALID_USERNAME") "HTTP $($spaces.Status)"
$badMail = Register -UserName "reg_mail_$suffix" -Email "not-an-email"
Check "a malformed e-mail is a 400 INVALID_EMAIL" ($badMail.Status -eq 400 -and $badMail.Json.error -eq "INVALID_EMAIL") "HTTP $($badMail.Status)"
$noPass = Register -UserName "reg_pass_$suffix" -Email "pass_$suffix@blinkr.local" -Password ""
Check "an empty password is a 400 INVALID_PASSWORD" ($noPass.Status -eq 400 -and $noPass.Json.error -eq "INVALID_PASSWORD") "HTTP $($noPass.Status)"

# Rejected attempts must not have created accounts.
$login = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $email; password = "BlinkrSmoke!2026" }
Check "login works with the exact e-mail" ($login.Status -eq 200 -and $login.Json.token)
$loginUpper = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $email.ToUpperInvariant(); password = "BlinkrSmoke!2026" }
Check "login ignores the case of the e-mail" ($loginUpper.Status -eq 200 -and $loginUpper.Json.userId -eq $first.Json.userId) "HTTP $($loginUpper.Status)"
$wrong = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $email; password = "wrong-password" }
Check "a wrong password is still a 401" ($wrong.Status -eq 401) "HTTP $($wrong.Status)"

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-AUTH-02: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "`nPASS BLK-AUTH-02 registration rules"
