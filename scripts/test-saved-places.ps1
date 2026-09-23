param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-SAVED-01 (sinyal-mvp-plan Faz 6 kabul: "kayıtlı yerler iki cihazda aynı"): a place saved on one device shows on
# another session of the same account; device-local saves import once without duplicates; nobody else sees them.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Compress -Depth 6); $args.ContentType = "application/json; charset=utf-8" }
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

Write-Host "BLK-SAVED-01 saved places via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$name = "saved_$suffix"
$password = "BlinkrSmoke!2026"
$reg = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $name; email = "$name@blinkr.local"; password = $password }
$deviceA = $reg.Json.token
$login = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = "$name@blinkr.local"; password = $password }
$deviceB = $login.Json.token
Check "two sessions of one account" ([bool]$deviceA -and [bool]$deviceB) "login HTTP $($login.Status) $($login.Raw)"
$other = (Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = "other_$suffix"; email = "other_$suffix@blinkr.local"; password = $password }).Json.token

$p1 = [guid]::NewGuid(); $p2 = [guid]::NewGuid(); $p3 = [guid]::NewGuid()
$save = Invoke-Api -Method PUT -Path "/api/users/me/saved-places/$p1" -Token $deviceA -Body @{ name = "Kahve Durağı"; category = "CAFE"; latitude = 37.07; longitude = 36.25 }
Check "save on device A" ($save.Status -eq 200 -and $save.Json.saved -eq $true) "HTTP $($save.Status) $($save.Raw)"
$again = Invoke-Api -Method PUT -Path "/api/users/me/saved-places/$p1" -Token $deviceA -Body @{ name = "Kahve Durağı"; category = "CAFE"; latitude = 37.07; longitude = 36.25 }
Check "saving twice is idempotent" ($again.Status -eq 200)
$onB = Invoke-Api -Method GET -Path "/api/users/me/saved-places" -Token $deviceB
Check "device B sees the same place" (@($onB.Json).Count -eq 1 -and $onB.Json[0].id -eq "$p1" -and $onB.Json[0].name -eq "Kahve Durağı") "$($onB.Raw)"

$bad = Invoke-Api -Method PUT -Path "/api/users/me/saved-places/$p2" -Token $deviceA -Body @{ name = ""; latitude = 99; longitude = 36 }
Check "invalid place is refused (400)" ($bad.Status -eq 400)

# Device B had saved p2 and p1 locally before sync: import adds only what is new.
$import = Invoke-Api -Method POST -Path "/api/users/me/saved-places/import" -Token $deviceB -Body @{ items = @(
    @{ id = "$p2"; name = "Kent Müzesi"; category = "TOURISM"; latitude = 37.08; longitude = 36.26 },
    @{ id = "$p1"; name = "Kahve Durağı"; category = "CAFE"; latitude = 37.07; longitude = 36.25 },
    @{ id = "$p3"; name = ""; category = "PARK"; latitude = 37.0; longitude = 36.0 }
) }
Check "import merges without duplicates and skips invalid rows" ($import.Status -eq 200 -and @($import.Json).Count -eq 2) "$($import.Raw)"
$onA = Invoke-Api -Method GET -Path "/api/users/me/saved-places" -Token $deviceA
Check "device A now sees both" (@($onA.Json).Count -eq 2 -and (@($onA.Json | ForEach-Object { $_.id }) -contains "$p2"))

$theirs = Invoke-Api -Method GET -Path "/api/users/me/saved-places" -Token $other
Check "another account sees none of them" (@($theirs.Json).Count -eq 0)
$guest = Invoke-Api -Method GET -Path "/api/users/me/saved-places"
Check "signed-out callers get nothing (401)" ($guest.Status -eq 401)

$del = Invoke-Api -Method DELETE -Path "/api/users/me/saved-places/$p1" -Token $deviceB
$afterDel = Invoke-Api -Method GET -Path "/api/users/me/saved-places" -Token $deviceA
Check "removing on B removes it on A" ($del.Status -eq 200 -and @($afterDel.Json).Count -eq 1 -and $afterDel.Json[0].id -eq "$p2")

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-SAVED-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    exit 1
}
Write-Host "`nPASS BLK-SAVED-01 saved places"
