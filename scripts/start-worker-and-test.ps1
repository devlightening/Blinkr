# Start Worker and test immediately

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  🚀 STARTING WORKER WITH FIX 🚀   ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Green

# Kill existing Worker
Get-Process | Where-Object {$_.ProcessName -like "*Worker*"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Start Worker in background
$workerPath = "$PSScriptRoot\..\src\Services\WorkerService\Blinkr.Projections.Worker"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$workerPath'; dotnet run" -WindowStyle Normal

Write-Host "[1] Worker starting... waiting 15 seconds`n" -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "[2] Creating test post...`n" -ForegroundColor Yellow
cd "$PSScriptRoot\.."
$response = curl.exe -s -X POST http://localhost:5215/api/posts -H "Content-Type: application/json" -d "@scripts/test-post-simple.json" | ConvertFrom-Json
$postId = $response.postId

Write-Host "    ✅ PostId: $postId`n" -ForegroundColor Green

Write-Host "[3] Waiting 10 seconds for event processing...`n" -ForegroundColor Yellow
1..10 | ForEach-Object { Write-Host "    ." -NoNewline -ForegroundColor Gray; Start-Sleep -Seconds 1 }
Write-Host " Done!`n" -ForegroundColor Green

Write-Host "[4] Checking MongoDB...`n" -ForegroundColor Yellow
$mongoCmd = @"
db = db.getSiblingDB('BlinkrReadModel');
db.auth('blinkr_re', 'blinkr123');
var post = db.posts.findOne({'_id': '$postId'});
if (post) {
    print('');
    print('🎉🎉🎉 SUCCESS! POST FOUND IN MONGODB! 🎉🎉🎉');
    print('');
    print('PostId: ' + post._id);
    print('Title: ' + post.title);
    print('AuthorId: ' + post.authorId);
    print('Content: ' + post.content.substring(0, 80) + '...');
    print('Created: ' + post.createdAtUtc);
    print('');
    print('✅ COMPLETE CQRS EVENT SOURCING FLOW WORKING!');
    print('✅ EventStore -> Publisher -> RabbitMQ -> Worker -> MongoDB');
    print('');
} else {
    print('❌ NOT FOUND in MongoDB');
    print('Total posts: ' + db.posts.countDocuments({}));
}
"@

$result = $mongoCmd | docker exec -i blinkr_mongodb mongosh --quiet
Write-Host $result -ForegroundColor White

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         TEST COMPLETE!             ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host "`nCheck Worker console window for detailed logs" -ForegroundColor Gray
