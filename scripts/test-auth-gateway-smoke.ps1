param(
    [string]$GatewayBaseUrl = "http://localhost:5080",
    [switch]$SkipNotifications
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
    param(
        [ValidateSet("GET", "POST", "PUT", "DELETE")]
        [string]$Method,
        [string]$Url,
        [object]$Body,
        [hashtable]$Headers = @{},
        [int[]]$ExpectedStatus = @(200)
    )

    try {
        $args = @{
            Method = $Method
            Uri = $Url
            Headers = $Headers
            TimeoutSec = 20
            UseBasicParsing = $true
        }
        if ($null -ne $Body) {
            $args.ContentType = "application/json"
            $args.Body = ($Body | ConvertTo-Json -Depth 10)
        }

        $response = Invoke-WebRequest @args
        $status = [int]$response.StatusCode
        if ($ExpectedStatus -notcontains $status) {
            throw "Expected status $($ExpectedStatus -join '/') but got $status from $Url"
        }

        if ([string]::IsNullOrWhiteSpace($response.Content)) {
            return @{ status = $status; body = $null }
        }

        return @{ status = $status; body = ($response.Content | ConvertFrom-Json) }
    } catch {
        $response = $_.Exception.Response
        if ($null -ne $response) {
            $status = [int]$response.StatusCode
            if ($ExpectedStatus -contains $status) {
                return @{ status = $status; body = $null }
            }
        }
        throw
    }
}

function Decode-JwtPayload {
    param([string]$Token)
    $payload = $Token.Split(".")[1].Replace("-", "+").Replace("_", "/")
    switch ($payload.Length % 4) {
        2 { $payload += "==" }
        3 { $payload += "=" }
    }
    [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
}

function Assert-Equal {
    param([object]$Actual, [object]$Expected, [string]$Message)
    if ($Actual -ne $Expected) {
        throw "$Message Expected '$Expected' but got '$Actual'."
    }
}

function Assert-Truthy {
    param([object]$Value, [string]$Message)
    if (-not $Value) {
        throw $Message
    }
}

$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$email = "auth_smoke_$suffix@blinkr.local"
$password = "BlinkrSmoke!2026"
$headers = @{ Accept = "application/json" }

Write-Host "BLK-AUTH-01 smoke via $GatewayBaseUrl" -ForegroundColor Cyan

$register = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/auth/register" -Headers $headers -Body @{
    userName = "auth_smoke_$suffix"
    email = $email
    password = $password
}
Assert-Truthy $register.body.token "Register did not return an access token."
Assert-Truthy $register.body.refreshToken "Register did not return a refresh token."

$login = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/auth/login" -Headers $headers -Body @{
    userName = $email
    password = $password
}
Assert-Truthy $login.body.token "Login did not return an access token."

$payload = Decode-JwtPayload -Token $login.body.token
Assert-Equal $payload.iss "Blinkr.Identity" "Issuer mismatch."
$aud = if ($payload.aud -is [array]) { $payload.aud[0] } else { $payload.aud }
Assert-Equal $aud "blinkr.api" "Audience mismatch."
Assert-Truthy $payload.sub "Token is missing sub."
Assert-Truthy $payload.scope "Token is missing scope."

$authHeaders = @{
    Accept = "application/json"
    Authorization = "Bearer $($login.body.token)"
}

$missing = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/posts" -Headers $headers -ExpectedStatus @(401) -Body @{
    title = "Should not pass"
    content = "Missing bearer token"
    authorName = "auth_smoke"
}
Assert-Equal $missing.status 401 "Missing-token status mismatch."

$invalid = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/posts" -Headers @{
    Accept = "application/json"
    Authorization = "Bearer invalid.token.value"
} -ExpectedStatus @(401) -Body @{
    title = "Should not pass"
    content = "Invalid bearer token"
    authorName = "auth_smoke"
}
Assert-Equal $invalid.status 401 "Invalid-token status mismatch."

$post = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/posts" -Headers $authHeaders -ExpectedStatus @(200, 201) -Body @{
    title = "Auth smoke Istanbul"
    content = "BLK-AUTH-01 protected Gateway mutation"
    authorName = "auth_smoke"
    latitude = 41.0082
    longitude = 28.9784
    accuracyMeters = 25
    locationName = "Istanbul auth smoke"
    visibility = "Public"
    audienceType = "Public"
}
$createdPostId = $post.body.PostId
if (-not $createdPostId) { $createdPostId = $post.body.postId }
if (-not $createdPostId) { $createdPostId = $post.body.id }
Assert-Truthy $createdPostId "Protected post did not return id."

$bounds = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/posts-read/bounds?minLat=40.5&maxLat=41.5&minLng=28.5&maxLng=29.5" -Headers $headers -ExpectedStatus @(200)
Assert-Equal $bounds.status 200 "Public bounds status mismatch."

$refresh = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/auth/refresh" -Headers $headers -Body @{
    refreshToken = $login.body.refreshToken
}
Assert-Truthy $refresh.body.token "Refresh did not return a new access token."

$reusedRefresh = Invoke-Json -Method POST -Url "$GatewayBaseUrl/api/auth/refresh" -Headers $headers -ExpectedStatus @(401) -Body @{
    refreshToken = $login.body.refreshToken
}
Assert-Equal $reusedRefresh.status 401 "Reused refresh token should be rejected."

if (-not $SkipNotifications) {
    $notifications = Invoke-Json -Method GET -Url "$GatewayBaseUrl/api/notifications/unread-count" -Headers $authHeaders -ExpectedStatus @(200)
    Assert-Equal $notifications.status 200 "Notifications protected endpoint mismatch."
}

Write-Host "PASS BLK-AUTH-01 smoke" -ForegroundColor Green
Write-Host "User: $email"
Write-Host "PostId: $createdPostId"
