param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-ACCOUNT-01 (plan-devam Faz F): birth year at sign-up (under 13 refused, under 18 starts private and can only
# message friends), a data request, account deletion with a 30-day grace that signing in can cancel, and the purge:
# the profile, signals, comments, likes and chat content of a deleted account are gone everywhere.
# Needs the Development settings (short grace allowed for e2e_ accounts, sweep every 10 s).

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
function Register([string]$UserName, $BirthYear) {
    $body = @{ userName = $UserName; email = "$UserName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($null -ne $BirthYear) { $body.birthYear = $BirthYear }
    Invoke-Api -Method POST -Path "/api/auth/register" -Body $body
}
function Wait-Until([scriptblock]$Condition, [int]$Seconds = 60) {
    for ($i = 0; $i -lt $Seconds; $i++) { if (& $Condition) { return $true }; Start-Sleep -Seconds 1 }
    return $false
}

Write-Host "BLK-ACCOUNT-01 account lifecycle via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$year = [DateTime]::UtcNow.Year
# A name that does not look like a test account (no long digit run), so the birth-year rule applies to it.
$letters = -join ($suffix.ToString().ToCharArray() | ForEach-Object { [char](97 + [int]"$_") })

# --- Birth year (F5) ---
$noYear = Register "qa$letters" $null
Check "a real sign-up needs a birth year" ($noYear.Status -eq 400 -and $noYear.Json.error -eq "BIRTH_YEAR_REQUIRED") "HTTP $($noYear.Status) $($noYear.Raw)"
$child = Register "qa$letters" ($year - 10)
Check "under 13 cannot sign up" ($child.Status -eq 400 -and $child.Json.error -eq "AGE_TOO_YOUNG") "HTTP $($child.Status) $($child.Raw)"
$minorAuth = (Register "e2e_acc_minor_$suffix" ($year - 15)).Json
$adultAuth = (Register "e2e_acc_adult_$suffix" 1990).Json
$minorMe = Invoke-Api -Method GET -Path "/api/users/me" -Token $minorAuth.token
$adultMe = Invoke-Api -Method GET -Path "/api/users/me" -Token $adultAuth.token
Check "under 18 starts private, adults do not" ($minorMe.Json.isPrivate -eq $true -and $adultMe.Json.isPrivate -eq $false) "minor=$($minorMe.Json.isPrivate) adult=$($adultMe.Json.isPrivate)"
$dm = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $adultAuth.token -Body @{ targetUserId = $minorAuth.userId }
Check "a stranger cannot message someone under 18" ($dm.Status -eq 403) "HTTP $($dm.Status)"
Invoke-Api -Method POST -Path "/api/friends/requests" -Token $adultAuth.token -Body @{ userId = $minorAuth.userId } | Out-Null
Invoke-Api -Method POST -Path "/api/friends/requests/$($adultAuth.userId)/accept" -Token $minorAuth.token | Out-Null
$dmFriends = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $adultAuth.token -Body @{ targetUserId = $minorAuth.userId }
Check "friends can message someone under 18" ($dmFriends.Status -eq 200 -or $dmFriends.Status -eq 201) "HTTP $($dmFriends.Status)"

# --- The account that will be deleted, and what it leaves around ---
$goneAuth = (Register "e2e_acc_gone_$suffix" 1995).Json
$other = (Register "e2e_acc_other_$suffix" 1992).Json
$base = @{ latitude = 37.0746; longitude = 36.2464; accuracyMeters = 20; locationName = "Test"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea" }
$ownPost = (Invoke-Api -Method POST -Path "/api/posts" -Token $goneAuth.token -Body ($base + @{ title = ""; content = "Silinecek hesabın sinyali"; signalType = "Crowd"; signalValue = "Busy" })).Json.postId
$otherPost = (Invoke-Api -Method POST -Path "/api/posts" -Token $other.token -Body ($base + @{ title = ""; content = "Başkasının sinyali"; signalType = "Queue"; signalValue = "LONG" })).Json.postId
Wait-Until { (Invoke-Api -Method GET -Path "/api/posts/$otherPost" -Token $goneAuth.token).Status -eq 200 } 20 | Out-Null
Invoke-Api -Method POST -Path "/api/posts/$otherPost/comments" -Token $goneAuth.token -Body @{ commentText = "Silinecek yorum" } | Out-Null
Invoke-Api -Method POST -Path "/api/posts/$otherPost/likes" -Token $goneAuth.token | Out-Null
$conv = (Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $goneAuth.token -Body @{ targetUserId = $other.userId }).Json.id
Invoke-Api -Method POST -Path "/api/chat/conversations/$conv/messages" -Token $goneAuth.token -Body @{ text = "Bu mesaj silinecek" } | Out-Null
$ready = Wait-Until { $p = Invoke-Api -Method GET -Path "/api/posts/$otherPost" -Token $other.token; $p.Json.likeCount -eq 1 -and $p.Json.commentCount -ge 1 } 30
Check "the account's comment and like are on the other signal first" $ready

# --- Data request (F4) ---
$dr1 = Invoke-Api -Method POST -Path "/api/users/me/data-requests" -Token $goneAuth.token
$dr2 = Invoke-Api -Method POST -Path "/api/users/me/data-requests" -Token $goneAuth.token
Check "a data request is recorded once per 30 days" ($dr1.Status -eq 201 -and $dr2.Status -eq 200 -and $dr2.Json.repeated -eq $true -and $dr2.Json.id -eq $dr1.Json.id) "dr1=$($dr1.Status) dr2=$($dr2.Status)"

# --- Deletion with grace, and cancel (F3) ---
$wrong = Invoke-Api -Method POST -Path "/api/users/me/deletion" -Token $goneAuth.token -Body @{ password = "yanlis" }
Check "deletion needs the password" ($wrong.Status -eq 400 -and $wrong.Json.error -eq "WRONG_PASSWORD") "HTTP $($wrong.Status)"
$req = Invoke-Api -Method POST -Path "/api/users/me/deletion" -Token $goneAuth.token -Body @{ password = "BlinkrSmoke!2026"; graceSeconds = 3600 }
Check "deletion is scheduled" ($req.Status -eq 200 -and $null -ne $req.Json.deletionScheduledForUtc) $req.Raw
$login = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = "e2e_acc_gone_$suffix@blinkr.local"; password = "BlinkrSmoke!2026" }
Check "signing in during the grace shows the pending deletion" ($login.Status -eq 200 -and $null -ne $login.Json.deletionScheduledForUtc) "HTTP $($login.Status)"
$cancel = Invoke-Api -Method DELETE -Path "/api/users/me/deletion" -Token $login.Json.token
$after = Invoke-Api -Method GET -Path "/api/users/me" -Token $login.Json.token
Check "cancelling keeps the account" ($cancel.Status -eq 200 -and $null -eq $after.Json.deletionScheduledForUtc) "cancel=$($cancel.Status)"

# --- Deletion that runs out, and the purge everywhere ---
Invoke-Api -Method POST -Path "/api/users/me/deletion" -Token $login.Json.token -Body @{ password = "BlinkrSmoke!2026"; graceSeconds = 0 } | Out-Null
$purged = Wait-Until { (Invoke-Api -Method GET -Path "/api/users/$($goneAuth.userId)" -Token $other.token).Status -eq 404 } 60
Check "after the grace the profile is gone" $purged
$relogin = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = "e2e_acc_gone_$suffix@blinkr.local"; password = "BlinkrSmoke!2026" }
Check "the deleted account cannot sign in" ($relogin.Status -eq 401) "HTTP $($relogin.Status)"
$search = Invoke-Api -Method GET -Path "/api/users/search?q=e2e_acc_gone_$suffix" -Token $other.token
Check "the deleted account is not found by search" (@($search.Json).Count -eq 0) $search.Raw
$postGone = Wait-Until { (Invoke-Api -Method GET -Path "/api/posts/$ownPost" -Token $other.token).Status -eq 404 } 45
Check "the account's own signal is deleted" $postGone
$cleaned = Wait-Until { $p = Invoke-Api -Method GET -Path "/api/posts/$otherPost" -Token $other.token; $p.Json.likeCount -eq 0 -and $p.Json.commentCount -eq 0 } 45
Check "its comment and like on another signal are removed" $cleaned
$chat = Invoke-Api -Method GET -Path "/api/chat/conversations/$conv/messages" -Token $other.token
$theirs = @($chat.Json.items | Where-Object { $_.senderId -eq $goneAuth.userId })
Check "its chat messages are emptied for the other person" ($theirs.Count -ge 1 -and @($theirs | Where-Object { $_.kind -ne "unsent" -or $_.text -ne "" }).Count -eq 0) $chat.Raw
$reply = Invoke-Api -Method POST -Path "/api/chat/conversations/$conv/messages" -Token $other.token -Body @{ text = "Orada mısın?" }
Check "a deleted account cannot be messaged" ($reply.Status -eq 403) "HTTP $($reply.Status)"

if ($script:failures.Count -gt 0) { Write-Host "BLK-ACCOUNT-01 FAILED: $($script:failures -join ', ')" -ForegroundColor Red; exit 1 }
Write-Host "BLK-ACCOUNT-01 PASS"
