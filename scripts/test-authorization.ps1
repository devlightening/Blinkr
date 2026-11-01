param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-AUTHZ-01 (object-level access): a stranger may not change or remove someone else's signal or comment, read or
# write a conversation they are not in, touch someone's story, or reach the admin endpoints; and every attempt leaves
# the data as it was. Anonymous callers get 401 on writes.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, $Body, [byte[]]$Raw, [string]$ContentType)
    $args = @{ UseBasicParsing = $true; Uri = "$GatewayBaseUrl$Path"; Method = $Method; TimeoutSec = 30; Headers = @{} }
    if ($Token) { $args.Headers["Authorization"] = "Bearer $Token" }
    if ($null -ne $Body) { $args.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress -Depth 5)); $args.ContentType = "application/json; charset=utf-8" }
    if ($null -ne $Raw) { $args.Body = $Raw; $args.ContentType = $ContentType }
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
function Denied([int]$Status) { $Status -in 401, 403, 404 }

function Register-SmokeUser {
    param([string]$Label, [string]$Suffix)
    $userName = "e2e_authz_${Label}_$Suffix"
    $r = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ userName = $userName; email = "$userName@blinkr.local"; password = "BlinkrSmoke!2026" }
    if ($r.Status -ne 200 -and $r.Status -ne 201) { throw "Register $Label failed: HTTP $($r.Status)" }
    [pscustomobject]@{ UserName = $userName; Token = $r.Json.token; Id = $r.Json.userId }
}

Write-Host "BLK-AUTHZ-01 object-level access via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$a = Register-SmokeUser -Label "a" -Suffix $suffix
$b = Register-SmokeUser -Label "b" -Suffix $suffix
$c = Register-SmokeUser -Label "stranger" -Suffix $suffix

$post = Invoke-Api -Method POST -Path "/api/posts" -Token $a.Token -Body @{
    title = "Asil"; content = "Authorization smoke."; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25
    locationName = "Osmaniye"; signalType = "GeneralObservation"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea"
}
$postId = $post.Json.postId
for ($i = 0; $i -lt 30; $i++) { if ((Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $b.Token).Status -eq 200) { break }; Start-Sleep -Milliseconds 500 }
$comment = (Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Token $a.Token -Body @{ commentText = "Sahibin yorumu" }).Json.commentId
$conversation = (Invoke-Api -Method POST -Path "/api/chat/conversations" -Token $a.Token -Body @{ targetUserId = $b.Id }).Json.id
$null = Invoke-Api -Method POST -Path "/api/chat/conversations/$conversation/messages" -Token $a.Token -Body @{ text = "Ozel" }
$jpeg = [byte[]](0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x04, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x02, 0x11, 0x22, 0xFF, 0xD9)
$story = (Invoke-Api -Method POST -Path "/api/stories?durationSeconds=5" -Token $a.Token -Raw $jpeg -ContentType "image/jpeg").Json.id

# Signals and comments.
Check "a stranger cannot edit someone's signal" (Denied (Invoke-Api -Method PUT -Path "/api/posts/$postId" -Token $c.Token -Body @{ title = "Ele gecirildi"; content = "Ele gecirildi" }).Status)
Check "a stranger cannot delete someone's signal" (Denied (Invoke-Api -Method DELETE -Path "/api/posts/$postId" -Token $c.Token).Status)
Check "a stranger cannot delete someone's comment" (Denied (Invoke-Api -Method DELETE -Path "/api/posts/$postId/comments/$comment" -Token $c.Token).Status)
Start-Sleep -Seconds 2
$still = Invoke-Api -Method GET -Path "/api/posts/$postId" -Token $b.Token
Check "the signal is untouched" ($still.Status -eq 200 -and $still.Json.title -eq "Asil") "$($still.Raw)"
Check "the comment is still there" (@((Invoke-Api -Method GET -Path "/api/posts/$postId/comments" -Token $b.Token).Json.items | Where-Object { $_.commentId -eq $comment }).Count -eq 1)
Check "an anonymous caller cannot write" ((Invoke-Api -Method POST -Path "/api/posts/$postId/comments" -Body @{ commentText = "anon" }).Status -eq 401)

# Conversations.
Check "a stranger cannot read a conversation" (Denied (Invoke-Api -Method GET -Path "/api/chat/conversations/$conversation/messages" -Token $c.Token).Status)
Check "a stranger cannot write into it" (Denied (Invoke-Api -Method POST -Path "/api/chat/conversations/$conversation/messages" -Token $c.Token -Body @{ text = "icerideyim" }).Status)
Check "a stranger cannot mark it read or type in it" ((Denied (Invoke-Api -Method POST -Path "/api/chat/conversations/$conversation/read" -Token $c.Token).Status) -and (Denied (Invoke-Api -Method POST -Path "/api/chat/conversations/$conversation/typing" -Token $c.Token).Status))
Check "a stranger does not see it in their list" (@((Invoke-Api -Method GET -Path "/api/chat/conversations" -Token $c.Token).Json.items | Where-Object { $_.id -eq $conversation }).Count -eq 0)
$messages = Invoke-Api -Method GET -Path "/api/chat/conversations/$conversation/messages" -Token $b.Token
Check "the other person sees only the real message" ($messages.Status -eq 200 -and @($messages.Json.items).Count -eq 1)

# Stories and admin.
Check "a stranger cannot delete someone's story" (Denied (Invoke-Api -Method DELETE -Path "/api/stories/$story" -Token $c.Token).Status)
Check "a stranger cannot list its viewers" (Denied (Invoke-Api -Method GET -Path "/api/stories/$story/viewers" -Token $c.Token).Status)
Check "a normal account cannot open the moderation queue" ((Invoke-Api -Method GET -Path "/api/admin/reports" -Token $c.Token).Status -in 403, 404)
Check "a normal account cannot reconcile the read model" ((Invoke-Api -Method POST -Path "/api/admin/read-models/reconcile" -Token $c.Token).Status -eq 403)
Check "the author can still delete their own story" ((Invoke-Api -Method DELETE -Path "/api/stories/$story" -Token $a.Token).Status -in 200, 204)

if ($script:failures.Count -gt 0) { Write-Host "BLK-AUTHZ-01 FAIL ($($script:failures.Count))" -ForegroundColor Red; exit 1 }
Write-Host "BLK-AUTHZ-01 PASS"
