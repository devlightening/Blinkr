# Final comprehensive test with verbose logging

Write-Host "=== FINAL CQRS FLOW TEST ===" -ForegroundColor Cyan
Write-Host ""

# Stop all services
Write-Host "[1] Stopping services..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*Worker*" -or $_.ProcessName -like "*BlogService*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start Worker
Write-Host "[2] Starting Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\src\Services\WorkerService\Blinkr.Projections.Worker'; dotnet run" -WindowStyle Normal
Start-Sleep -Seconds 10

# Start BlogService
Write-Host "[3] Starting BlogService..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\src\Services\BlogService\BlogService.Api'; dotnet run" -WindowStyle Normal
Start-Sleep -Seconds 10

# Wait for services to be ready
Write-Host "[4] Waiting for services..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Create post
Write-Host "[5] Creating test post..." -ForegroundColor Yellow
$response = curl.exe -s -X POST http://localhost:5215/api/posts -H "Content-Type: application/json" -d "@$PSScriptRoot\test-post-simple.json" | ConvertFrom-Json
$postId = $response.postId
Write-Host "    PostId: $postId" -ForegroundColor Green

# Wait
Write-Host "[6] Waiting for event processing (10s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check results
Write-Host "[7] Checking results..." -ForegroundColor Yellow

Write-Host "  [EventStore]" -ForegroundColor Cyan
$es = curl.exe -s -H "Accept: application/vnd.eventstore.atom+json" "http://localhost:2113/streams/PostAggregate-$postId" | ConvertFrom-Json
Write-Host "    Events: $($es.entries.Count)" -ForegroundColor $(if ($es.entries.Count -gt 0) {'Green'} else {'Red'})

Write-Host "  [RabbitMQ]" -ForegroundColor Cyan
$queues = curl.exe -s -u user:password http://localhost:15672/api/queues | ConvertFrom-Json
Write-Host "    Queues: $($queues.Count)" -ForegroundColor $(if ($queues.Count -gt 0) {'Green'} else {'Red'})
$exchanges = curl.exe -s -u user:password http://localhost:15672/api/exchanges | ConvertFrom-Json | Where-Object {$_.name -like "*Post*"}
Write-Host "    Exchanges: $($exchanges.Count)" -ForegroundColor $(if ($exchanges.Count -gt 0) {'Green'} else {'Red'})

Write-Host "  [MongoDB]" -ForegroundColor Cyan
$mongoCmd = "db=db.getSiblingDB('BlinkrReadModel');db.auth('blinkr_re','blinkr123');db.posts.findOne({'_id':'$postId'})?print('FOUND'):print('NOT FOUND');"
$mongoResult = $mongoCmd | docker exec -i blinkr_mongodb mongosh --quiet 2>$null
Write-Host "    Status: $mongoResult" -ForegroundColor $(if ($mongoResult -match 'FOUND') {'Green'} else {'Red'})

Write-Host ""
Write-Host "=== TEST COMPLETE ===" -ForegroundColor Cyan
Write-Host "PostId: $postId" -ForegroundColor Yellow
Write-Host "Check console windows for detailed logs" -ForegroundColor Gray
