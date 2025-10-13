# Test Create Post with OAuth2 Authentication

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OAUTH2 AUTHENTICATED POST TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Get Access Token from IdentityServer
Write-Host "[STEP 1] Getting OAuth2 access token..." -ForegroundColor Yellow

$tokenUrl = "http://localhost:5036/connect/token"
$tokenBody = @{
    grant_type = "password"
    username = "mehmetlocal"
    password = "postgres123"
    client_id = "blinkr.ro.client"
    client_secret = "super_secret"
    scope = "blinkr.api.read blinkr.api.write"
}

try {
    $tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
    $accessToken = $tokenResponse.access_token
    Write-Host "    [OK] Access token received (expires in $($tokenResponse.expires_in)s)" -ForegroundColor Green
} catch {
    Write-Host "    [ERROR] Failed to get token: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "    [INFO] Response: $($_.Exception.Response)" -ForegroundColor Gray
    exit 1
}

Write-Host ""

# 2. Create Post with Authentication
Write-Host "[STEP 2] Creating authenticated post..." -ForegroundColor Yellow

$postData = @{
    title = "OAuth2 Authenticated Test Post"
    content = "Bu post OAuth2 authentication ile olusturuldu. Kullanici: mehmetlocal. CQRS Event akisini test ediyoruz: BlogService -> EventStore -> RabbitMQ -> Worker -> MongoDB"
    media = @()
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $accessToken"
}

try {
    $createResponse = Invoke-RestMethod -Uri "http://localhost:5215/api/posts" -Method Post -Body $postData -Headers $headers
    $newPostId = $createResponse.postId
    Write-Host "    [OK] Post created! PostId: $newPostId" -ForegroundColor Green
} catch {
    Write-Host "    [ERROR] Failed to create post: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. Wait for event processing
Write-Host "[STEP 3] Waiting for event processing (8 seconds)..." -ForegroundColor Yellow
1..8 | ForEach-Object {
    Write-Host "    ." -NoNewline -ForegroundColor Gray
    Start-Sleep -Seconds 1
}
Write-Host " Done!" -ForegroundColor Gray
Write-Host ""

# 4. Verify EventStore
Write-Host "[STEP 4] Checking EventStore..." -ForegroundColor Yellow
try {
    $esCheck = curl.exe -s -H "Accept: application/vnd.eventstore.atom+json" "http://localhost:2113/streams/PostAggregate-$newPostId" | ConvertFrom-Json
    if ($esCheck.entries.Count -gt 0) {
        Write-Host "    [OK] Event found in EventStore" -ForegroundColor Green
    } else {
        Write-Host "    [ERROR] No events in EventStore!" -ForegroundColor Red
    }
} catch {
    Write-Host "    [ERROR] EventStore check failed" -ForegroundColor Red
}

Write-Host ""

# 5. Verify RabbitMQ
Write-Host "[STEP 5] Checking RabbitMQ queues..." -ForegroundColor Yellow
try {
    $queues = curl.exe -s -u user:password http://localhost:15672/api/queues | ConvertFrom-Json
    if ($queues.Count -gt 0) {
        Write-Host "    [OK] Found $($queues.Count) queue(s):" -ForegroundColor Green
        $queues | ForEach-Object {
            Write-Host "        - $($_.name): $($_.messages) msg, $($_.consumers) consumers" -ForegroundColor Cyan
        }
    } else {
        Write-Host "    [WARNING] No queues found in RabbitMQ" -ForegroundColor Yellow
    }
} catch {
    Write-Host "    [ERROR] RabbitMQ check failed" -ForegroundColor Red
}

Write-Host ""

# 6. Verify MongoDB
Write-Host "[STEP 6] Checking MongoDB projection..." -ForegroundColor Yellow
$mongoCheck = @"
db = db.getSiblingDB('BlinkrReadModel');
db.auth('blinkr_re', 'blinkr123');
var doc = db.posts.findOne({'_id': '$newPostId'});
if (doc) {
    print('[SUCCESS] Post found in MongoDB!');
    print('Title: ' + doc.title);
    print('Content: ' + doc.content.substring(0, 50) + '...');
    print('AuthorId: ' + doc.authorId);
} else {
    print('[NOT FOUND] Post not in MongoDB yet');
    print('Total posts: ' + db.posts.countDocuments({}));
}
"@

try {
    $mongoResult = $mongoCheck | docker exec -i blinkr_mongodb mongosh --quiet 2>$null
    Write-Host "    $mongoResult" -ForegroundColor Cyan
} catch {
    Write-Host "    [ERROR] MongoDB check failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST COMPLETE - PostId: $newPostId" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
