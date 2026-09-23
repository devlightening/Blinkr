param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-FOLLOW-01 (sinyal-mvp-plan Faz 6 kabul): follow a public account at once; a private account gets a request,
# and only after it is accepted can the follower see the profile's signals and lists; blocking removes follows both
# ways and hides the two people from each other; the public profile never carries an e-mail.

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
    $userName = "fol_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

Write-Host "BLK-FOLLOW-01 follows via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$ali = Register-SmokeUser -Label "ali" -Suffix $suffix
$ece = Register-SmokeUser -Label "ece" -Suffix $suffix
$can = Register-SmokeUser -Label "can" -Suffix $suffix

# A signal by Ece so her profile has something to show.
$post = Invoke-Api -Method POST -Path "/api/posts" -Token $ece.Token -Body @{ title = "follow-$suffix"; content = "Follow smoke signal."; signalType = "GeneralObservation"; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25; locationName = "Osmaniye"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea" }
Check "ece posted" ($post.Status -eq 201)

# --- Public account: following is immediate ---
$self = Invoke-Api -Method POST -Path "/api/follows/$($ali.Id)" -Token $ali.Token
Check "cannot follow yourself (400 SELF)" ($self.Status -eq 400 -and $self.Json.error -eq "SELF")
$f1 = Invoke-Api -Method POST -Path "/api/follows/$($ece.Id)" -Token $ali.Token
Check "following a public account is immediate" ($f1.Status -eq 200 -and $f1.Json.follow -eq "following") "HTTP $($f1.Status) $($f1.Raw)"
$again = Invoke-Api -Method POST -Path "/api/follows/$($ece.Id)" -Token $ali.Token
Check "following twice is idempotent" ($again.Json.follow -eq "following")
$eceProfile = Invoke-Api -Method GET -Path "/api/users/$($ece.Id)" -Token $ali.Token
Check "profile shows counts and my follow state" ($eceProfile.Json.followerCount -eq 1 -and $eceProfile.Json.follow -eq "following" -and $eceProfile.Json.canSeeContent -eq $true) "$($eceProfile.Raw)"
Check "public profile has no e-mail" (-not $eceProfile.Raw.Contains("@blinkr.local") -and -not ($eceProfile.Raw -match '"email"'))
$aliFromEce = Invoke-Api -Method GET -Path "/api/users/$($ali.Id)" -Token $ece.Token
Check "the followed person sees 'follows you'" ($aliFromEce.Json.followsYou -eq $true -and $aliFromEce.Json.followingCount -eq 1)
$followers = Invoke-Api -Method GET -Path "/api/users/$($ece.Id)/followers" -Token $can.Token
Check "followers list is visible for a public account" ($followers.Status -eq 200 -and $followers.Json.totalCount -eq 1 -and $followers.Json.items[0].id -eq $ali.Id) "HTTP $($followers.Status) $($followers.Raw)"

# --- Private account: requests, then content ---
$priv = Invoke-Api -Method PUT -Path "/api/users/me/privacy" -Token $ece.Token -Body @{ isPrivate = $true }
Check "ece goes private" ($priv.Status -eq 200 -and $priv.Json.isPrivate -eq $true)
$req = Invoke-Api -Method POST -Path "/api/follows/$($ece.Id)" -Token $can.Token
Check "following a private account is a request" ($req.Json.follow -eq "requested") "$($req.Raw)"
$canView = Invoke-Api -Method GET -Path "/api/users/$($ece.Id)" -Token $can.Token
Check "a pending follower cannot see content yet" ($canView.Json.canSeeContent -eq $false -and $canView.Json.isPrivate -eq $true -and $canView.Json.follow -eq "requested")
$lockedList = Invoke-Api -Method GET -Path "/api/users/$($ece.Id)/followers" -Token $can.Token
Check "private followers list is closed (403)" ($lockedList.Status -eq 403) "HTTP $($lockedList.Status)"
$lockedPosts = Invoke-Api -Method GET -Path "/api/posts-read/author/$($ece.Id)" -Token $can.Token
Check "private account's signals are closed to non-followers (403)" ($lockedPosts.Status -eq 403) "HTTP $($lockedPosts.Status)"
$guestPosts = Invoke-Api -Method GET -Path "/api/posts-read/author/$($ece.Id)"
Check "... and to signed-out callers" ($guestPosts.Status -eq 403) "HTTP $($guestPosts.Status)"
$aliPosts = Invoke-Api -Method GET -Path "/api/posts-read/author/$($ece.Id)" -Token $ali.Token
Check "an existing follower still sees them" ($aliPosts.Status -eq 200) "HTTP $($aliPosts.Status)"
$ownPosts = Invoke-Api -Method GET -Path "/api/posts-read/author/$($ece.Id)" -Token $ece.Token
Check "the owner always sees their own" ($ownPosts.Status -eq 200)

$me = Invoke-Api -Method GET -Path "/api/users/me" -Token $ece.Token
Check "owner sees one waiting request" ($me.Json.followRequestCount -eq 1 -and $me.Json.isPrivate -eq $true)
$requests = Invoke-Api -Method GET -Path "/api/follows/requests" -Token $ece.Token
Check "request list names the requester" (@($requests.Json).Count -eq 1 -and $requests.Json[0].id -eq $can.Id)
$wrongAccept = Invoke-Api -Method POST -Path "/api/follows/requests/$($can.Id)/accept" -Token $ali.Token
Check "only the owner can accept (404 otherwise)" ($wrongAccept.Status -eq 404)
$accept = Invoke-Api -Method POST -Path "/api/follows/requests/$($can.Id)/accept" -Token $ece.Token
Check "owner accepts" ($accept.Status -eq 200)
$afterAccept = Invoke-Api -Method GET -Path "/api/posts-read/author/$($ece.Id)" -Token $can.Token
Check "after acceptance the follower sees the signals" ($afterAccept.Status -eq 200 -and @($afterAccept.Json).Count -ge 1) "HTTP $($afterAccept.Status)"

# --- Remove follower, unfollow ---
$removed = Invoke-Api -Method DELETE -Path "/api/follows/followers/$($can.Id)" -Token $ece.Token
Check "owner removes a follower" ($removed.Status -eq 200)
$canAgain = Invoke-Api -Method GET -Path "/api/users/$($ece.Id)" -Token $can.Token
Check "the removed follower is locked out again" ($canAgain.Json.follow -eq "none" -and $canAgain.Json.canSeeContent -eq $false)
$reReq = Invoke-Api -Method POST -Path "/api/follows/$($ece.Id)" -Token $can.Token
$public = Invoke-Api -Method PUT -Path "/api/users/me/privacy" -Token $ece.Token -Body @{ isPrivate = $false }
$canPublic = Invoke-Api -Method GET -Path "/api/users/$($ece.Id)" -Token $can.Token
Check "going public approves waiting requests" ($reReq.Json.follow -eq "requested" -and $canPublic.Json.follow -eq "following")
$unf = Invoke-Api -Method DELETE -Path "/api/follows/$($ece.Id)" -Token $can.Token
Check "unfollow" ($unf.Json.follow -eq "none")

# --- Blocking ends follows both ways and hides people ---
$null = Invoke-Api -Method POST -Path "/api/follows/$($ali.Id)" -Token $ece.Token
$block = Invoke-Api -Method POST -Path "/api/blocks" -Token $ece.Token -Body @{ userId = $ali.Id }
Check "ece blocks ali" ($block.Status -eq 200)
$aliMe = Invoke-Api -Method GET -Path "/api/users/me" -Token $ali.Token
Check "block ended follows both ways" ($aliMe.Json.followingCount -eq 0 -and $aliMe.Json.followerCount -eq 0) "$($aliMe.Raw)"
$refollow = Invoke-Api -Method POST -Path "/api/follows/$($ece.Id)" -Token $ali.Token
Check "the blocked person cannot follow (403)" ($refollow.Status -eq 403 -and $refollow.Json.error -eq "FOLLOW_NOT_ALLOWED")
$blockedPosts = Invoke-Api -Method GET -Path "/api/posts-read/author/$($ece.Id)" -Token $ali.Token
Check "the blocked person cannot list her signals" ($blockedPosts.Status -eq 403)
$eceFollowers = Invoke-Api -Method GET -Path "/api/users/$($can.Id)/following" -Token $ali.Token
Check "lists stay reachable for others" ($eceFollowers.Status -eq 200)

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-FOLLOW-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    exit 1
}
Write-Host "`nPASS BLK-FOLLOW-01 follows"
