param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-CARD-01 (plan-devam Faz C): what the Sinyal Kartı needs from GET /api/posts/{id} - publication trust, isMine for
# the author only, anonymous authors hidden - and view counting (C12): once per person per day, never shown to others,
# the author's own views not requested by the app.

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
function Register-SmokeUser([string]$Label, [string]$Suffix) {
    $userName = "e2e_card_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}
function Wait-Post([string]$PostId, [string]$Token) {
    for ($i = 0; $i -lt 40; $i++) {
        $r = Invoke-Api -Method GET -Path "/api/posts/$PostId" -Token $Token
        if ($r.Status -eq 200) { return $r }
        Start-Sleep -Milliseconds 500
    }
    return $r
}

Write-Host "BLK-CARD-01 Sinyal Kartı data via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$author = Register-SmokeUser "author" $suffix
$viewer = Register-SmokeUser "viewer" $suffix
$other = Register-SmokeUser "other" $suffix

$post = Invoke-Api -Method POST -Path "/api/posts" -Token $author.Token -Body @{ title = "Sıra"; content = "Kasada uzun kuyruk"; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 20; locationName = "Test"; signalType = "Queue"; signalValue = "LONG"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea" }
$postId = $post.Json.postId
$asViewer = Wait-Post $postId $viewer.Token
Check "the viewer gets the card data" ($asViewer.Status -eq 200 -and $asViewer.Json.authorId -eq $author.Id -and $asViewer.Json.isMine -eq $false) "HTTP $($asViewer.Status)"
Check "publication trust is returned" ($asViewer.Json.PSObject.Properties.Name -contains "publicationTrust")
Check "views are not shown to others" ($null -eq $asViewer.Json.viewCount)
$asAuthor = Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $author.Token
Check "the author sees isMine and a view count" ($asAuthor.Json.isMine -eq $true -and $asAuthor.Json.viewCount -eq 0) "isMine=$($asAuthor.Json.isMine) views=$($asAuthor.Json.viewCount)"

$v1 = Invoke-Api -Method POST -Path "/api/posts/views" -Token $viewer.Token -Body @{ postIds = @($postId) }
$v2 = Invoke-Api -Method POST -Path "/api/posts/views" -Token $viewer.Token -Body @{ postIds = @($postId) }
$v3 = Invoke-Api -Method POST -Path "/api/posts/views" -Token $other.Token -Body @{ postIds = @($postId, [guid]::NewGuid().ToString()) }
Check "views are recorded once per person per day" ($v1.Status -eq 200 -and $v1.Json.recorded -eq 1 -and $v2.Json.recorded -eq 0 -and $v3.Json.recorded -ge 1) "v1=$($v1.Raw) v2=$($v2.Raw) v3=$($v3.Raw)"
$anonViews = Invoke-Api -Method POST -Path "/api/posts/views" -Body @{ postIds = @($postId) }
Check "recording views needs a token" ($anonViews.Status -eq 401) "HTTP $($anonViews.Status)"
$again = Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $author.Token
Check "the author's count reflects two people" ($again.Json.viewCount -eq 2) "views=$($again.Json.viewCount)"

$anon = Invoke-Api -Method POST -Path "/api/posts" -Token $author.Token -Body @{ title = ""; content = "Anonim gözlem"; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 20; locationName = "Test"; signalType = "Crowd"; signalValue = "Busy"; audienceType = "Public"; identityDisclosure = "AnonymousMap"; locationPrecision = "ApproximateArea" }
$anonCard = Wait-Post $anon.Json.postId $viewer.Token
Check "an anonymous signal never reveals its author" ($anonCard.Json.authorId -eq "00000000-0000-0000-0000-000000000000" -and $anonCard.Raw -notmatch $author.Id -and $anonCard.Raw -notmatch $author.UserName) "authorId=$($anonCard.Json.authorId)"
$anonOwn = Invoke-Api -Method GET -Path "/api/posts/$($anon.Json.postId)" -Token $author.Token
Check "the author still knows the anonymous signal is theirs" ($anonOwn.Json.isMine -eq $true)

if ($script:failures.Count -gt 0) { Write-Host "BLK-CARD-01 FAILED: $($script:failures -join ', ')" -ForegroundColor Red; exit 1 }
Write-Host "BLK-CARD-01 PASS"
