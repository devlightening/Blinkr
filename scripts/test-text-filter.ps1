param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-TEXTFILTER-02 (sinyal-mvp-plan Faz 10 P10.1): the synchronous text filter on every public text path, end to end.
# Threats/hate are refused with 422 CONTENT_BLOCKED (posts, edits, comments, chat, snap and story captions, bio);
# Turkish national ID numbers and number plates are masked before they are stored (posts, comments, bio); private
# chat is not masked; light swearing is published but flagged "sensitive" in the nearby feed.
# The word lists themselves are unit-tested in tests/ContentFilter (BLK-TEXTFILTER-01).

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]
$TcNumber = "10000000146"   # checksum-valid test number
$Bullet = [string][char]0x2022

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body, [string]$RawBody, [string]$ContentType)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress -Depth 5)); $args.ContentType = "application/json; charset=utf-8" }
    if ($RawBody) { $args.Body = [System.Text.Encoding]::UTF8.GetBytes($RawBody); $args.ContentType = $ContentType }
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
    $userName = "e2e_tf_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

function Wait-For {
    param([string]$Path, [string]$Token, [scriptblock]$Until)
    $last = $null
    for ($i = 0; $i -lt 30; $i++) {
        $last = Invoke-Api -Method GET -Path $Path -Token $Token
        if ($last.Status -eq 200 -and (& $Until $last)) { return $last }
        Start-Sleep -Milliseconds 500
    }
    return $last
}

function Is-Blocked($r) { return $r.Status -eq 422 -and ($r.Json.code -eq "CONTENT_BLOCKED" -or $r.Json.error -eq "CONTENT_BLOCKED") }

Write-Host "BLK-TEXTFILTER-02 text filter via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$a = Register-SmokeUser -Label "a" -Suffix $suffix
$b = Register-SmokeUser -Label "b" -Suffix $suffix
$lat = 37.0746; $lon = 36.2464

function New-Post([string]$Title, [string]$Content, $User = $a) {
    Invoke-Api -Method POST -Path "/api/posts" -Token $User.Token -Body @{ title = $Title; content = $Content; latitude = $lat; longitude = $lon; accuracyMeters = 25; locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea" }
}

# Posts
$threat = New-Post "Uyarı" "Seni öldüreceğim, bekle"
Check "a threat in a post is refused" (Is-Blocked $threat) "HTTP $($threat.Status) $($threat.Raw)"
$hateTitle = New-Post "pis suriyeli" "Park dolu"
Check "hate in the title is refused" (Is-Blocked $hateTitle) "HTTP $($hateTitle.Status)"
$masked = New-Post "Cüzdan bulundu" "TC $TcNumber yazıyor, 34 ABC 123 plakalı aracın önünde."
Check "a post with an ID number and a plate is accepted" ($masked.Status -eq 201) "HTTP $($masked.Status) $($masked.Raw)"
$maskedId = $masked.Json.postId
$detail = Wait-For -Path "/api/posts/$maskedId" -Token $b.Token -Until { param($r) $r.Json.id -eq $maskedId }
Check "the stored post has the ID number masked" ($detail.Raw -notmatch $TcNumber -and $detail.Json.content -match [regex]::Escape($Bullet * 11)) "content=$($detail.Json.content)"
Check "the stored post has the plate masked, province kept" ($detail.Json.content -match "34 $([regex]::Escape($Bullet * 3)) $([regex]::Escape($Bullet * 3))" -and $detail.Raw -notmatch "ABC 123")
$edit = Invoke-Api -Method PUT -Path "/api/posts/$maskedId" -Token $a.Token -Body @{ title = "Cüzdan"; content = "kill yourself" }
Check "an edit into a threat is refused" (Is-Blocked $edit) "HTTP $($edit.Status)"

# Light swearing: published, flagged in the nearby feed.
$mild = New-Post "Sıra" "amk yine kuyruk var $suffix"
Check "light swearing is published" ($mild.Status -eq 201) "HTTP $($mild.Status)"
$mildId = $mild.Json.postId
# Another author: the feed shows at most two signals per person per page (DiscoverRanking diversity).
$clean = New-Post "Sakin" "Kafe sakin $suffix" $b
$cleanId = $clean.Json.postId
$feed = Wait-For -Path "/api/discover/nearby?lat=$lat&lon=$lon&radiusMeters=2000&pageSize=30" -Token $b.Token -Until { param($r) @($r.Json.items | Where-Object { $_.id -eq $mildId }).Count -gt 0 -and @($r.Json.items | Where-Object { $_.id -eq $cleanId }).Count -gt 0 }
$mildItem = @($feed.Json.items | Where-Object { $_.id -eq $mildId })[0]
$cleanItem = @($feed.Json.items | Where-Object { $_.id -eq $cleanId })[0]
Check "the swearing post is flagged sensitive" ($mildItem.sensitive -eq $true) "item=$($mildItem | ConvertTo-Json -Compress -Depth 2)"
Check "a clean post is not flagged" ($cleanItem.sensitive -eq $false)

# Comments
$badComment = Invoke-Api -Method POST -Path "/api/posts/$maskedId/comments" -Token $b.Token -Body @{ commentText = "ananı sikeyim" }
Check "an insulting comment is refused" (Is-Blocked $badComment) "HTTP $($badComment.Status) $($badComment.Raw)"
$idComment = Invoke-Api -Method POST -Path "/api/posts/$maskedId/comments" -Token $b.Token -Body @{ commentText = "Sahibi $TcNumber olabilir" }
Check "a comment with an ID number is accepted" ($idComment.Status -eq 200) "HTTP $($idComment.Status)"
$thread = Wait-For -Path "/api/posts/$maskedId/comments" -Token $b.Token -Until { param($r) $r.Json.commentCount -ge 1 }
Check "the stored comment has the ID number masked" ($thread.Json.commentCount -ge 1 -and $thread.Raw -notmatch $TcNumber) "raw=$($thread.Raw)"

# Chat (not masked, but threats refused) and snap caption
$conv = Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $b.Id }
$convId = $conv.Json.id
$badMsg = Invoke-Api -Method POST -Path "/api/chat/conversations/$convId/messages" -Token $a.Token -Body @{ text = "I will kill you" }
Check "a threat in chat is refused" (Is-Blocked $badMsg) "HTTP $($badMsg.Status) $($badMsg.Raw)"
$plateMsg = Invoke-Api -Method POST -Path "/api/chat/conversations/$convId/messages" -Token $a.Token -Body @{ text = "Arabam 34 ABC 123" }
Check "private chat keeps a plate as written" ($plateMsg.Status -eq 200 -and $plateMsg.Json.text -eq "Arabam 34 ABC 123") "HTTP $($plateMsg.Status) $($plateMsg.Raw)"
$badSnap = Invoke-Api -Method POST -Path "/api/chat/conversations/$convId/snaps?durationSeconds=5&caption=$([uri]::EscapeDataString('kill yourself'))" -Token $a.Token -RawBody "x" -ContentType "image/jpeg"
Check "a threatening snap caption is refused" (Is-Blocked $badSnap) "HTTP $($badSnap.Status)"

# Story caption
$badStory = Invoke-Api -Method POST -Path "/api/stories?durationSeconds=5&caption=$([uri]::EscapeDataString('orospu çocuğu'))" -Token $a.Token -RawBody "x" -ContentType "image/jpeg"
Check "an insulting story caption is refused" (Is-Blocked $badStory) "HTTP $($badStory.Status)"

# Bio
$badBio = Invoke-Api -Method PUT -Path "/api/users/me/profile" -Token $a.Token -Body @{ bio = "pis ermeni" }
Check "hate in the bio is refused" (Is-Blocked $badBio) "HTTP $($badBio.Status) $($badBio.Raw)"
$plateBio = Invoke-Api -Method PUT -Path "/api/users/me/profile" -Token $a.Token -Body @{ bio = "Aracım 06 AB 1234" }
Check "a plate in the bio is masked" ($plateBio.Status -eq 200 -and $plateBio.Json.bio -eq "Aracım 06 $($Bullet * 2) $($Bullet * 4)") "HTTP $($plateBio.Status) bio=$($plateBio.Json.bio)"
$cleanBio = Invoke-Api -Method PUT -Path "/api/users/me/profile" -Token $a.Token -Body @{ bio = "Kahve ve yürüyüş" }
Check "a clean bio is stored as written" ($cleanBio.Status -eq 200 -and $cleanBio.Json.bio -eq "Kahve ve yürüyüş")

if ($script:failures.Count -gt 0) {
    Write-Host "BLK-TEXTFILTER-02 FAILED: $($script:failures -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "BLK-TEXTFILTER-02 PASS"
