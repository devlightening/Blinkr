# Final comprehensive flow test

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FINAL CQRS EVENT FLOW TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Create new post
Write-Host "[STEP 1] Creating new post..." -ForegroundColor Yellow
$postJson = @"
{
  "title": "FINAL TEST POST",
  "content": "Bu final test - tam akim kontrolu: BlogService -> EventStore -> Publisher -> RabbitMQ -> Worker -> MongoDB",
  "media": []
}
"@

try {
    $response = curl.exe -s -X POST "http://localhost:5215/api/posts" -H "Content-Type: application/json" -d $postJson | ConvertFrom-Json
    $newPostId = $response.postId
    Write-Host "    [OK] Post created: $newPostId" -ForegroundColor Green
} catch {
    Write-Host "    [ERROR] Failed to create post" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. Wait for event processing
Write-Host "[STEP 2] Waiting for event processing (10 seconds)..." -ForegroundColor Yellow
1..10 | ForEach-Object {
    Write-Host "    ." -NoNewline -ForegroundColor Gray
    Start-Sleep -Seconds 1
}
Write-Host " Done!" -ForegroundColor Gray
Write-Host ""

# 3. Check EventStore
Write-Host "[STEP 3] Checking EventStore..." -ForegroundColor Yellow
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

# 4. Check RabbitMQ
Write-Host "[STEP 4] Checking RabbitMQ..." -ForegroundColor Yellow
try {
    $queues = curl.exe -s -u user:password http://localhost:15672/api/queues | ConvertFrom-Json
    if ($queues.Count -gt 0) {
        Write-Host "    [OK] Found $($queues.Count) queue(s):" -ForegroundColor Green
        $queues | ForEach-Object {
            Write-Host "        - $($_.name): $($_.messages) msg, $($_.consumers) consumers" -ForegroundColor Cyan
        }
    } else {
        Write-Host "    [WARNING] No queues found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "    [ERROR] RabbitMQ check failed" -ForegroundColor Red
}

Write-Host ""

# 5. Check MongoDB
Write-Host "[STEP 5] Checking MongoDB..." -ForegroundColor Yellow
$mongoCheck = @"
db = db.getSiblingDB('BlinkrReadModel');
db.auth('blinkr_re', 'blinkr123');
var doc = db.posts.findOne({'_id': '$newPostId'});
if (doc) {
    print('[SUCCESS] Post found!');
    print('Title: ' + doc.title);
} else {
    print('[NOT FOUND] Post not in MongoDB');
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
