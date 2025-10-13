param([string]$PostId)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  COMPREHENSIVE FLOW VERIFICATION" -ForegroundColor Cyan
Write-Host "  PostId: $PostId" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. EventStore Check
Write-Host "[1] EventStore Stream Check" -ForegroundColor Yellow
$esUrl = "http://localhost:2113/streams/PostAggregate-$PostId"
try {
    $esData = curl.exe -s -H "Accept: application/vnd.eventstore.atom+json" $esUrl | ConvertFrom-Json
    if ($esData.entries -and $esData.entries.Count -gt 0) {
        Write-Host "    ✅ FOUND: $($esData.entries.Count) event(s)" -ForegroundColor Green
        $esData.entries | ForEach-Object {
            Write-Host "       - $($_.summary)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "    ❌ NOT FOUND" -ForegroundColor Red
    }
} catch {
    Write-Host "    ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 2. RabbitMQ Detailed Check
Write-Host "[2] RabbitMQ Status" -ForegroundColor Yellow
try {
    $queues = curl.exe -s -u user:password http://localhost:15672/api/queues | ConvertFrom-Json
    Write-Host "    Total Queues: $($queues.Count)" -ForegroundColor Cyan
    
    $postCreatedQueue = $queues | Where-Object { $_.name -eq 'blinkr-post-created' }
    if ($postCreatedQueue) {
        Write-Host "    ✅ blinkr-post-created:" -ForegroundColor Green
        Write-Host "       - Messages: $($postCreatedQueue.messages)" -ForegroundColor Cyan
        Write-Host "       - Ready: $($postCreatedQueue.messages_ready)" -ForegroundColor Cyan
        Write-Host "       - Consumers: $($postCreatedQueue.consumers)" -ForegroundColor Cyan
    } else {
        Write-Host "    ❌ blinkr-post-created queue NOT FOUND" -ForegroundColor Red
    }
    
    $exchanges = curl.exe -s -u user:password http://localhost:15672/api/exchanges | ConvertFrom-Json | Where-Object {$_.name -like "*Post*"}
    Write-Host "    Post-related Exchanges: $($exchanges.Count)" -ForegroundColor Cyan
    
} catch {
    Write-Host "    ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 3. MongoDB Check
Write-Host "[3] MongoDB Projection Check" -ForegroundColor Yellow
$mongoCommand = @"
db = db.getSiblingDB('BlinkrReadModel');
db.auth('blinkr_re', 'blinkr123');

var post = db.posts.findOne({'_id': '$PostId'});

if (post) {
    print('✅ POST FOUND IN MONGODB!');
    print('');
    print('Title: ' + post.title);
    print('Content: ' + post.content.substring(0, 80) + '...');
    print('AuthorId: ' + post.authorId);
    print('CreatedAt: ' + post.createdAtUtc);
    print('LikeCount: ' + post.likeCount);
} else {
    print('❌ POST NOT FOUND');
    print('');
    print('Total posts in collection: ' + db.posts.countDocuments({}));
    print('');
    print('Recent posts:');
    db.posts.find().sort({createdAtUtc: -1}).limit(3).forEach(function(p) {
        print('  - ' + p._id + ': ' + p.title);
    });
}
"@

try {
    $mongoResult = $mongoCommand | docker exec -i blinkr_mongodb mongosh --quiet 2>$null
    Write-Host "    $mongoResult" -ForegroundColor White
} catch {
    Write-Host "    ❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
