param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-PRIVACY-01: listing posts by author must work for the author and must never reveal which
# anonymous (AnonymousMap) posts belong to whom (product constitution 10.3).

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Compress); $args.ContentType = "application/json" }
    $status = 0; $raw = ""; $headers = $null
    try {
        $response = Invoke-WebRequest @args
        $status = [int]$response.StatusCode; $raw = [string]$response.Content; $headers = $response.Headers
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        $status = [int]$response.StatusCode
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream()); $raw = $reader.ReadToEnd(); $reader.Dispose()
    }
    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) { try { $json = $raw | ConvertFrom-Json } catch { } }
    [pscustomobject]@{ Status = $status; Raw = $raw; Json = $json; Headers = $headers }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

function Register-SmokeUser {
    param([string]$Label, [string]$Suffix)
    $userName = "priv_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

function New-Post {
    param($User, [string]$Disclosure, [string]$Title)
    $r = Invoke-Api -Method POST -Path "/api/posts" -Token $User.Token -Body @{
        title = $Title; content = "Author privacy smoke ($Title)."; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25
        locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = $Disclosure
        locationPrecision = "ApproximateArea"; expiresAt = (Get-Date).ToUniversalTime().AddHours(3).ToString("o")
    }
    if ($r.Status -ne 201) { throw "Create $Disclosure post failed: HTTP $($r.Status) $($r.Raw)" }
}

function Titles { param($Response) @($Response.Json | ForEach-Object { $_ } | ForEach-Object { $_.title }) }
function Total { param($Response) [int]$Response.Headers["X-Total-Count"] }

Write-Host "BLK-PRIVACY-01 author posts privacy via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$author = Register-SmokeUser -Label "author" -Suffix $suffix
$other = Register-SmokeUser -Label "other" -Suffix $suffix
New-Post -User $author -Disclosure "LimitedProfile" -Title "public-$suffix"
New-Post -User $author -Disclosure "AnonymousMap" -Title "anonymous-$suffix"

$path = "/api/posts-read/author/$($author.Id)"
$owner = $null
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    $owner = Invoke-Api -Method GET -Path $path -Token $author.Token
    if ((Total $owner) -ge 2) { break }
}

# The author sees everything they posted, including anonymous posts, and it is never cacheable.
Check "author lists both posts" ($owner.Status -eq 200 -and (Total $owner) -eq 2) "status=$($owner.Status) total=$(Total $owner)"
Check "author sees own anonymous post" ((Titles $owner) -contains "anonymous-$suffix")
Check "author response is private" (([string]$owner.Headers["Cache-Control"]) -match "private" -and ([string]$owner.Headers["Cache-Control"]) -match "no-store") "Cache-Control=$($owner.Headers['Cache-Control'])"

# Everyone else sees only the non-anonymous post, signed in or not.
$anon = Invoke-Api -Method GET -Path $path
Check "anonymous caller sees only the public post" ($anon.Status -eq 200 -and (Total $anon) -eq 1 -and (Titles $anon) -contains "public-$suffix") "total=$(Total $anon)"
Check "anonymous caller never sees the anonymous post" (-not ((Titles $anon) -contains "anonymous-$suffix"))
$asOther = Invoke-Api -Method GET -Path $path -Token $other.Token
Check "another user sees only the public post" ((Total $asOther) -eq 1 -and -not ((Titles $asOther) -contains "anonymous-$suffix")) "total=$(Total $asOther)"

# The public list with ?authorId= is shared-cacheable, so it never includes anonymous posts - not even for the author.
$list = Invoke-Api -Method GET -Path "/api/posts-read?authorId=$($author.Id)" -Token $author.Token
Check "public list by authorId excludes anonymous posts, even for the author" ($list.Status -eq 200 -and -not ((Titles $list) -contains "anonymous-$suffix") -and (Titles $list) -contains "public-$suffix") "total=$(Total $list)"

# On the public map the anonymous post exists but does not reveal who wrote it.
$bounds = Invoke-Api -Method GET -Path "/api/posts-read/bounds?minLat=36.9&minLon=36.1&maxLat=37.2&maxLon=36.4&limit=500"
$onMap = @($bounds.Json.items | ForEach-Object { $_ } | Where-Object { $_.title -eq "anonymous-$suffix" })
Check "anonymous post is on the public map without its author" ($onMap.Count -eq 1 -and $onMap[0].authorId -eq "00000000-0000-0000-0000-000000000000" -and $onMap[0].authorName -ne $author.UserName) "found=$($onMap.Count) authorId=$($onMap[0].authorId) authorName=$($onMap[0].authorName)"

# Single-post detail (used to 404 because the read model mapped _id as a binary GUID).
$publicId = (@($owner.Json | ForEach-Object { $_ } | Where-Object { $_.title -eq "public-$suffix" })[0]).id
$anonId = (@($owner.Json | ForEach-Object { $_ } | Where-Object { $_.title -eq "anonymous-$suffix" })[0]).id
$publicDetail = Invoke-Api -Method GET -Path "/api/posts-read/$publicId"
Check "public post detail is found and shows its author" ($publicDetail.Status -eq 200 -and $publicDetail.Json.authorId -eq $author.Id) "HTTP $($publicDetail.Status) authorId=$($publicDetail.Json.authorId)"
$anonDetail = Invoke-Api -Method GET -Path "/api/posts-read/$anonId"
Check "anonymous post detail is found but hides its author" ($anonDetail.Status -eq 200 -and $anonDetail.Json.authorId -eq "00000000-0000-0000-0000-000000000000" -and -not $anonDetail.Raw.Contains($author.Id)) "HTTP $($anonDetail.Status) authorId=$($anonDetail.Json.authorId)"

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-PRIVACY-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "`nPASS BLK-PRIVACY-01 author posts privacy"
