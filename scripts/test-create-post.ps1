# Test script - BlogService'de Post oluşturup MongoDB'de doğrulama

Write-Host "[INFO] Testing CQRS Event Flow: BlogService -> EventStore -> RabbitMQ -> Worker -> MongoDB" -ForegroundColor Cyan
Write-Host ""

# 1. Token al (IdentityServer'dan)
Write-Host "[STEP 1] Getting access token from IdentityServer..." -ForegroundColor Yellow
$tokenUrl = "http://localhost:5211/connect/token"
$tokenBody = @{
    grant_type = "password"
    username = "testuser"
    password = "Test123!"
    client_id = "blogservice.client"
    client_secret = "secret"
    scope = "blogservice.api"
}

try {
    $tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
    $accessToken = $tokenResponse.access_token
    Write-Host "[OK] Access token received" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to get token: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[INFO] Trying without authentication..." -ForegroundColor Yellow
    $accessToken = $null
}

Write-Host ""

# 2. Post oluştur
Write-Host "[STEP 2] Creating a new post via BlogService API..." -ForegroundColor Yellow

$postData = @{
    title = "Test Post from PowerShell"
    content = "Bu post CQRS event flow'unu test ediyor: BlogService -> EventStore -> RabbitMQ -> Worker -> MongoDB"
    authorId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

if ($accessToken) {
    $headers["Authorization"] = "Bearer $accessToken"
}

try {
    $createResponse = Invoke-RestMethod -Uri "http://localhost:5215/api/posts" -Method Post -Body $postData -Headers $headers
    $postId = $createResponse.id
    Write-Host "[OK] Post created successfully! PostId: $postId" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to create post: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "[DEBUG] Response: $($_.Exception.Response)" -ForegroundColor Gray
    exit 1
}

Write-Host ""

# 3. RabbitMQ'yu kontrol et
Write-Host "[STEP 3] Checking RabbitMQ queues..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $rabbitUrl = "http://localhost:15672/api/queues"
    $rabbitCred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("user:password"))
    $rabbitHeaders = @{
        "Authorization" = "Basic $rabbitCred"
    }
    
    $queues = Invoke-RestMethod -Uri $rabbitUrl -Headers $rabbitHeaders
    $relevantQueues = $queues | Where-Object { $_.name -like "*Post*" }
    
    if ($relevantQueues) {
        Write-Host "[OK] Found RabbitMQ queues:" -ForegroundColor Green
        $relevantQueues | ForEach-Object {
            Write-Host "  - $($_.name): $($_.messages) messages" -ForegroundColor Cyan
        }
    } else {
        Write-Host "[WARNING] No Post-related queues found yet" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Could not connect to RabbitMQ Management API" -ForegroundColor Yellow
}

Write-Host ""

# 4. MongoDB'de kontrol et
Write-Host "[STEP 4] Checking MongoDB for the post..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$mongoCommand = @"
db = db.getSiblingDB('BlinkrReadModel');
db.auth('blinkr_re', 'blinkr123');
print('[QUERY] Searching for PostId: $postId');
var doc = db.posts.findOne({'_id': '$postId'});
if (doc) {
    print('[SUCCESS] Post found in MongoDB!');
    printjson(doc);
} else {
    print('[NOT FOUND] Post not found in MongoDB yet. It may take a few seconds...');
    print('[INFO] Total posts in collection: ' + db.posts.countDocuments({}));
}
"@

try {
    $mongoResult = $mongoCommand | docker exec -i blinkr_mongodb mongosh --quiet
    Write-Host $mongoResult
} catch {
    Write-Host "[ERROR] Failed to query MongoDB: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "[COMPLETE] Test finished! Check the results above." -ForegroundColor Cyan
Write-Host "[TIP] If post not found in MongoDB, check Worker logs for errors." -ForegroundColor Yellow
