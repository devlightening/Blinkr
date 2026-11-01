param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-FRIENDS-01: friend requests, friend list, profile bio and the public profile.
# Friendship only helps people find each other and message; it never leaks an e-mail, a friend list or a location.

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

function New-Person {
    param([string]$Prefix)
    $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $name = "e2e_$Prefix$suffix"
    $reg = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $name; email = "$name@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($reg.Status -ne 200) { throw "register $name failed: HTTP $($reg.Status) $($reg.Raw)" }
    Start-Sleep -Milliseconds 5
    [pscustomobject]@{ Name = $name; Id = [string]$reg.Json.userId; Token = [string]$reg.Json.token }
}

Write-Host "BLK-FRIENDS-01 friends and profile via $GatewayBaseUrl"
$ada = New-Person "fa"
$bek = New-Person "fb"
$can = New-Person "fc"

# --- guards
$anon = Invoke-Api -Method GET -Path "/api/friends"
Check "the friend list needs a signed-in user" ($anon.Status -eq 401) "HTTP $($anon.Status)"
$self = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $ada.Id } -Token $ada.Token
Check "you cannot ask yourself" ($self.Status -eq 400 -and $self.Json.error -eq "SELF") "HTTP $($self.Status) $($self.Raw)"
$ghost = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = [guid]::NewGuid().ToString() } -Token $ada.Token
Check "an unknown person is a 404 USER_NOT_FOUND" ($ghost.Status -eq 404 -and $ghost.Json.error -eq "USER_NOT_FOUND") "HTTP $($ghost.Status) $($ghost.Raw)"

# --- relation before anything
$profile0 = Invoke-Api -Method GET -Path "/api/users/$($bek.Id)" -Token $ada.Token
Check "strangers start as relation none" ($profile0.Status -eq 200 -and $profile0.Json.relation -eq "none") "HTTP $($profile0.Status) $($profile0.Raw)"

# --- request, idempotence, both sides' view
$send = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $bek.Id } -Token $ada.Token
Check "asking sends a request (outgoing)" ($send.Status -eq 200 -and $send.Json.relation -eq "outgoing") "HTTP $($send.Status) $($send.Raw)"
$again = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $bek.Id } -Token $ada.Token
Check "asking twice changes nothing" ($again.Status -eq 200 -and $again.Json.relation -eq "outgoing") "HTTP $($again.Status) $($again.Raw)"
$adaRequests = Invoke-Api -Method GET -Path "/api/friends/requests" -Token $ada.Token
Check "the sender sees the request as outgoing only" ($adaRequests.Status -eq 200 -and @($adaRequests.Json.outgoing).Count -eq 1 -and @($adaRequests.Json.incoming).Count -eq 0 -and $adaRequests.Json.outgoing[0].id -eq $bek.Id) "$($adaRequests.Raw)"
$bekRequests = Invoke-Api -Method GET -Path "/api/friends/requests" -Token $bek.Token
Check "the receiver sees it as incoming" ($bekRequests.Status -eq 200 -and @($bekRequests.Json.incoming).Count -eq 1 -and $bekRequests.Json.incoming[0].id -eq $ada.Id) "$($bekRequests.Raw)"
$bekMe = Invoke-Api -Method GET -Path "/api/users/me" -Token $bek.Token
Check "/me counts the waiting request" ($bekMe.Status -eq 200 -and $bekMe.Json.incomingRequestCount -eq 1 -and $bekMe.Json.friendCount -eq 0) "$($bekMe.Raw)"
$searchAsBek = Invoke-Api -Method GET -Path "/api/users/search?q=$($ada.Name)" -Token $bek.Token
$foundAda = @($searchAsBek.Json) | Where-Object { $_.id -eq $ada.Id } | Select-Object -First 1
Check "search shows the relation from the searcher's side (incoming)" ($foundAda -and $foundAda.relation -eq "incoming") "$($searchAsBek.Raw)"

# --- only the addressee can answer
$wrongAccept = Invoke-Api -Method POST -Path "/api/friends/requests/$($bek.Id)/accept" -Token $ada.Token
Check "the sender cannot accept their own request" ($wrongAccept.Status -eq 404 -and $wrongAccept.Json.error -eq "REQUEST_NOT_FOUND") "HTTP $($wrongAccept.Status) $($wrongAccept.Raw)"
$stranger = Invoke-Api -Method POST -Path "/api/friends/requests/$($ada.Id)/accept" -Token $can.Token
Check "a third person cannot accept it either" ($stranger.Status -eq 404) "HTTP $($stranger.Status)"

# --- accept
$accept = Invoke-Api -Method POST -Path "/api/friends/requests/$($ada.Id)/accept" -Token $bek.Token
Check "accepting makes them friends" ($accept.Status -eq 200 -and $accept.Json.relation -eq "friends") "HTTP $($accept.Status) $($accept.Raw)"
$adaFriends = Invoke-Api -Method GET -Path "/api/friends" -Token $ada.Token
$bekFriends = Invoke-Api -Method GET -Path "/api/friends" -Token $bek.Token
Check "both sides list each other" (@($adaFriends.Json).Count -eq 1 -and $adaFriends.Json[0].id -eq $bek.Id -and @($bekFriends.Json).Count -eq 1 -and $bekFriends.Json[0].id -eq $ada.Id) "$($adaFriends.Raw) / $($bekFriends.Raw)"
$adaMe = Invoke-Api -Method GET -Path "/api/users/me" -Token $ada.Token
Check "/me counts the friend" ($adaMe.Json.friendCount -eq 1 -and $adaMe.Json.incomingRequestCount -eq 0) "$($adaMe.Raw)"
$reverse = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $ada.Id } -Token $bek.Token
Check "asking an existing friend changes nothing" ($reverse.Status -eq 200 -and $reverse.Json.relation -eq "friends") "HTTP $($reverse.Status) $($reverse.Raw)"

# --- public profile privacy
$other = Invoke-Api -Method GET -Path "/api/users/$($bek.Id)" -Token $can.Token
$otherText = [string]$other.Raw
Check "a public profile shows no e-mail, friend list or friend count" ($other.Status -eq 200 -and $other.Json.relation -eq "none" -and $otherText -notmatch "email" -and $otherText -notmatch "friendCount" -and $otherText -notmatch "friends\b.*\[") $otherText
$canFriends = Invoke-Api -Method GET -Path "/api/friends" -Token $can.Token
Check "someone else's friendship never shows up in my list" ($canFriends.Status -eq 200 -and @($canFriends.Json).Count -eq 0) "$($canFriends.Raw)"

# --- bio
$bio = Invoke-Api -Method PUT -Path "/api/users/me/profile" -Body @{ bio = "  Kahve   ve`n`nyuruyus  " } -Token $ada.Token
Check "the bio is trimmed and tidied" ($bio.Status -eq 200 -and $bio.Json.bio -eq "Kahve ve yuruyus") "HTTP $($bio.Status) $($bio.Raw)"
$seen = Invoke-Api -Method GET -Path "/api/users/$($ada.Id)" -Token $can.Token
Check "others see the bio and the join date" ($seen.Json.bio -eq "Kahve ve yuruyus" -and $seen.Json.joinedAtUtc) "$($seen.Raw)"
$long = Invoke-Api -Method PUT -Path "/api/users/me/profile" -Body @{ bio = ("x" * 161) } -Token $ada.Token
Check "161 characters is a 400 BIO_TOO_LONG" ($long.Status -eq 400 -and $long.Json.error -eq "BIO_TOO_LONG") "HTTP $($long.Status) $($long.Raw)"
$exact = Invoke-Api -Method PUT -Path "/api/users/me/profile" -Body @{ bio = ("y" * 160) } -Token $ada.Token
Check "160 characters is fine" ($exact.Status -eq 200) "HTTP $($exact.Status)"
$clear = Invoke-Api -Method PUT -Path "/api/users/me/profile" -Body @{ bio = "   " } -Token $ada.Token
$cleared = Invoke-Api -Method GET -Path "/api/users/$($ada.Id)" -Token $can.Token
Check "a blank bio clears it" ($clear.Status -eq 200 -and -not $cleared.Json.bio) "HTTP $($clear.Status) $($cleared.Raw)"

# --- remove
$remove = Invoke-Api -Method DELETE -Path "/api/friends/$($ada.Id)" -Token $bek.Token
Check "either friend can end the friendship" ($remove.Status -eq 200 -and $remove.Json.relation -eq "none") "HTTP $($remove.Status) $($remove.Raw)"
$removeAgain = Invoke-Api -Method DELETE -Path "/api/friends/$($ada.Id)" -Token $bek.Token
Check "removing a non-friend is a 404 NOT_FRIENDS" ($removeAgain.Status -eq 404 -and $removeAgain.Json.error -eq "NOT_FRIENDS") "HTTP $($removeAgain.Status)"
$adaAfter = Invoke-Api -Method GET -Path "/api/friends" -Token $ada.Token
Check "the other side's list is empty again" (@($adaAfter.Json).Count -eq 0) "$($adaAfter.Raw)"

# --- cancel, decline, cooldown, reverse-request auto-accept
$sendCan = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $can.Id } -Token $ada.Token
$cancel = Invoke-Api -Method DELETE -Path "/api/friends/requests/$($can.Id)" -Token $ada.Token
Check "a request I sent can be taken back" ($sendCan.Json.relation -eq "outgoing" -and $cancel.Status -eq 200 -and $cancel.Json.relation -eq "none") "HTTP $($cancel.Status) $($cancel.Raw)"
$canRequests = Invoke-Api -Method GET -Path "/api/friends/requests" -Token $can.Token
Check "a cancelled request disappears for the receiver" (@($canRequests.Json.incoming).Count -eq 0) "$($canRequests.Raw)"

$null = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $can.Id } -Token $ada.Token
$decline = Invoke-Api -Method POST -Path "/api/friends/requests/$($ada.Id)/decline" -Token $can.Token
Check "declining answers the request" ($decline.Status -eq 200 -and $decline.Json.relation -eq "none") "HTTP $($decline.Status) $($decline.Raw)"
$adaSeesDecline = Invoke-Api -Method GET -Path "/api/friends/requests" -Token $ada.Token
Check "a declined request is not shown as waiting or declined to the sender" (@($adaSeesDecline.Json.outgoing).Count -eq 0) "$($adaSeesDecline.Raw)"
$retry = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $can.Id } -Token $ada.Token
Check "the declined sender cannot ask again straight away" ($retry.Status -eq 403 -and $retry.Json.error -eq "REQUEST_NOT_ALLOWED") "HTTP $($retry.Status) $($retry.Raw)"
$reverseAsk = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $ada.Id } -Token $can.Token
Check "the one who declined may ask instead (outgoing)" ($reverseAsk.Status -eq 200 -and $reverseAsk.Json.relation -eq "outgoing") "HTTP $($reverseAsk.Status) $($reverseAsk.Raw)"
$adaBack = Invoke-Api -Method POST -Path "/api/friends/requests" -Body @{ userId = $can.Id } -Token $ada.Token
Check "asking back someone who asked me means yes" ($adaBack.Status -eq 200 -and $adaBack.Json.relation -eq "friends") "HTTP $($adaBack.Status) $($adaBack.Raw)"

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-FRIENDS-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "`nPASS BLK-FRIENDS-01 friends and profile"
