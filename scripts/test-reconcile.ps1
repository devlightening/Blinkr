param(
    [string]$GatewayBaseUrl = "http://localhost:5080",
    [string]$MongoContainer = "blinkr_mongodb"
)

# BLK-RECONCILE-01 (CLAUDE.md §21 P1): the read model is broken on purpose (like counts, likers, a removed comment
# shown, comment likers, then the whole document gone) and POST /api/admin/read-models/reconcile finds each difference
# against EventStore and repairs it; only admins may call it. Needs the local Mongo container (docker exec mongosh).

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 60; Headers = @{} }
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

function Register-SmokeUser {
    param([string]$Label, [string]$Suffix)
    $userName = "e2e_rec_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Email = "$userName@blinkr.local"; Token = $r.Json.token; Id = $r.Json.userId }
}

function Mongo([string]$Js) {
    $out = & docker exec $MongoContainer mongosh --quiet BlinkrReadModel --eval $Js 2>&1
    if ($LASTEXITCODE -ne 0) { throw "mongosh failed: $out" }
    return $out
}

function Reconcile([string]$Token, [string]$PostId, [bool]$Repair) {
    Invoke-Api -Method POST -Path "/api/admin/read-models/reconcile?postId=$PostId&repair=$($Repair.ToString().ToLower())" -Token $Token
}

function Wait-For([string]$Path, [string]$Token, [scriptblock]$Until) {
    $last = $null
    for ($i = 0; $i -lt 30; $i++) { $last = Invoke-Api -Method GET -Path $Path -Token $Token; if ($last.Status -eq 200 -and (& $Until $last.Json)) { return $last }; Start-Sleep -Milliseconds 500 }
    return $last
}

Write-Host "BLK-RECONCILE-01 read model reconciliation via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$admin = Register-SmokeUser -Label "admin" -Suffix $suffix
$author = Register-SmokeUser -Label "author" -Suffix $suffix
$fan = Register-SmokeUser -Label "fan" -Suffix $suffix
& (Join-Path $PSScriptRoot "make-admin.ps1") -User $admin.UserName | Out-Null
$adminToken = (Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ userName = $admin.Email; password = "BlinkrSmoke!2026" }).Json.token

$post = Invoke-Api -Method POST -Path "/api/posts" -Token $author.Token -Body @{
    title = ""; content = "Reconcile smoke."; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25
    locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea"
}
$postId = $post.Json.postId
$null = Wait-For "/api/posts/$postId" $fan.Token { param($j) $j.id -eq $postId }
$null = Invoke-Api -Method POST -Path "/api/posts/$postId/reactions" -Token $fan.Token -Body @{ reaction = [char]::ConvertFromUtf32(0x1F525) }
$c1 = (Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $fan.Token -Body @{ commentText = "Birinci" }).Json.commentId
$c2 = (Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $author.Token -Body @{ commentText = "Ikinci" }).Json.commentId
$null = Wait-For "/api/posts/$postId/comments" $fan.Token { param($j) $j.commentCount -eq 2 }
$null = Invoke-Api -Method POST -Path "/api/posts/$postId/comments/$c2/like" -Token $fan.Token
$null = Wait-For "/api/posts/$postId/comments" $fan.Token { param($j) @($j.items | Where-Object { $_.commentId -eq $c2 -and $_.likeCount -eq 1 }).Count -eq 1 }
$null = Wait-For "/api/posts/$postId" $fan.Token { param($j) $j.likeCount -eq 1 }

Check "only an admin may reconcile" ((Reconcile $fan.Token $postId $false).Status -eq 403)
$clean = Reconcile $adminToken $postId $false
Check "a healthy signal has no differences" ($clean.Status -eq 200 -and $clean.Json.checked -eq 1 -and @($clean.Json.issues).Count -eq 0) "$($clean.Raw)"

# Break the read model on purpose.
$null = Mongo "db.posts.updateOne({ _id: '$postId' }, { `$set: { LikeCount: 7, LikedByUserIds: [] } })"
$null = Mongo "db.posts.updateOne({ _id: '$postId', 'Comments._id': '$c2' }, { `$set: { 'Comments.`$.LikedBy': [] } })"
$null = Mongo "db.posts.updateOne({ _id: '$postId' }, { `$push: { Comments: { _id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', AuthorId: UUID('$($fan.Id)'), Text: 'hayalet', CreatedAtUtc: new Date() } } })"

$report = Reconcile $adminToken $postId $false
$kinds = @($report.Json.issues | ForEach-Object { $_.kind })
Check "the report finds the like count and likers" ($kinds -contains "likes") "$($report.Raw)"
Check "the report finds the comment shown after its removal" ($kinds -contains "comments")
Check "the report finds the comment likers" ($kinds -contains "comment-likes")
Check "a report alone changes nothing" ($report.Json.repaired -eq $false -and (Mongo "db.posts.findOne({ _id: '$postId' }).LikeCount") -match "^7")

$fix = Reconcile $adminToken $postId $true
Check "repair acts on every difference" ($fix.Json.repaired -eq $true -and @($fix.Json.issues | Where-Object { -not $_.action }).Count -eq 0) "$($fix.Raw)"
$after = Reconcile $adminToken $postId $false
Check "after the repair there is nothing left" (@($after.Json.issues).Count -eq 0) "$($after.Raw)"
$read = Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $fan.Token
Check "the reader sees the right likes again" ($read.Json.likeCount -eq 1 -and $read.Json.myReaction -eq [char]::ConvertFromUtf32(0x1F525))

# The whole document gone: republished, then completed.
$null = Mongo "db.posts.deleteOne({ _id: '$postId' })"
$gone = Reconcile $adminToken $postId $true
Check "a missing signal is found and republished" (@($gone.Json.issues | Where-Object { $_.kind -eq "missing" -and $_.action }).Count -eq 1) "$($gone.Raw)"
$back = Wait-For "/api/posts/$postId" $fan.Token { param($j) $j.id -eq $postId }
Check "the worker projected it again" ($back.Status -eq 200)
$second = Reconcile $adminToken $postId $true
$null = Wait-For "/api/posts/$postId/comments" $fan.Token { param($j) $j.commentCount -eq 2 }
Start-Sleep -Seconds 1
$third = Reconcile $adminToken $postId $true
$final = Reconcile $adminToken $postId $false
Check "a second pass restores its likes and comments" (@($final.Json.issues).Count -eq 0) "$($final.Raw)"
$thread = Invoke-Api -Method GET -Path "/api/posts/$postId/comments" -Token $fan.Token
Check "readers see both comments and the comment like" ($thread.Json.commentCount -eq 2 -and @($thread.Json.items | Where-Object { $_.commentId -eq $c2 -and $_.likeCount -eq 1 }).Count -eq 1) "$($thread.Raw)"

& (Join-Path $PSScriptRoot "make-admin.ps1") -User $admin.UserName -Revoke | Out-Null
if ($script:failures.Count -gt 0) { Write-Host "BLK-RECONCILE-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-RECONCILE-01 PASS"
