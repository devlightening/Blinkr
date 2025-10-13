# Complete flow check script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CQRS EVENT FLOW DIAGNOSTIC CHECK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$postId = "437d66ac-9dca-45d7-a42d-3f1de32ff751"

# 1. Check EventStore
Write-Host "[1] EventStore Check" -ForegroundColor Yellow
Write-Host "    Checking stream: PostAggregate-$postId"
try {
    $esResponse = curl.exe -s -H "Accept: application/vnd.eventstore.atom+json" "http://localhost:2113/streams/PostAggregate-$postId" | ConvertFrom-Json
    $eventCount = $esResponse.entries.Count
    if ($eventCount -gt 0) {
        Write-Host "    [OK] Found $eventCount event(s) in EventStore" -ForegroundColor Green
        $esResponse.entries | ForEach-Object {
            Write-Host "        - Event: $($_.summary)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "    [ERROR] No events found in EventStore!" -ForegroundColor Red
    }
} catch {
    Write-Host "    [ERROR] Failed to connect to EventStore: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 2. Check RabbitMQ
Write-Host "[2] RabbitMQ Check" -ForegroundColor Yellow
try {
    $rabbitQueues = curl.exe -s -u user:password http://localhost:15672/api/queues | ConvertFrom-Json
    $relevantQueues = $rabbitQueues | Where-Object { $_.name -like "*Post*" -or $_.name -like "*Blinkr*" }
    
    if ($relevantQueues) {
        Write-Host "    [OK] Found RabbitMQ queue(s):" -ForegroundColor Green
        $relevantQueues | ForEach-Object {
            Write-Host "        - $($_.name): $($_.messages) messages, $($_.messages_ready) ready" -ForegroundColor Cyan
        }
    } else {
        Write-Host "    [WARNING] No relevant queues found in RabbitMQ" -ForegroundColor Yellow
        Write-Host "    [INFO] Total queues: $($rabbitQueues.Count)" -ForegroundColor Gray
    }
} catch {
    Write-Host "    [ERROR] Failed to connect to RabbitMQ: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 3. Check MongoDB
Write-Host "[3] MongoDB Check" -ForegroundColor Yellow
$mongoCommand = @"
db = db.getSiblingDB('BlinkrReadModel');
db.auth('blinkr_re', 'blinkr123');
var doc = db.posts.findOne({'_id': '$postId'});
if (doc) {
    print('[OK] Post found');
} else {
    print('[NOT FOUND] Post not in MongoDB');
}
print('Total posts: ' + db.posts.countDocuments({}));
"@

try {
    $mongoResult = $mongoCommand | docker exec -i blinkr_mongodb mongosh --quiet 2>$null
    Write-Host "    $mongoResult" -ForegroundColor Cyan
} catch {
    Write-Host "    [ERROR] Failed to query MongoDB: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 4. Check running services
Write-Host "[4] Service Status Check" -ForegroundColor Yellow
$services = Get-Process | Where-Object {$_.ProcessName -like "*BlogService*" -or $_.ProcessName -like "*Worker*"}
if ($services) {
    $services | ForEach-Object {
        Write-Host "    [OK] $($_.ProcessName) (PID: $($_.Id)) - Running since $($_.StartTime.ToString('HH:mm:ss'))" -ForegroundColor Green
    }
} else {
    Write-Host "    [ERROR] No services running!" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTIC COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
