param([string]$PostId)

Write-Host "Verifying PostId: $PostId" -ForegroundColor Cyan
Write-Host ""

# EventStore
Write-Host "[1] EventStore:" -ForegroundColor Yellow
$es = curl.exe -s -H "Accept: application/vnd.eventstore.atom+json" "http://localhost:2113/streams/PostAggregate-$PostId" | ConvertFrom-Json
if ($es.entries) {
    Write-Host "    OK - $($es.entries.Count) event(s)" -ForegroundColor Green
} else {
    Write-Host "    NOT FOUND" -ForegroundColor Red
}

# RabbitMQ
Write-Host "[2] RabbitMQ:" -ForegroundColor Yellow
$queues = curl.exe -s -u user:password http://localhost:15672/api/queues | ConvertFrom-Json
if ($queues.Count -gt 0) {
    Write-Host "    OK - $($queues.Count) queue(s)" -ForegroundColor Green
    $queues | ForEach-Object { Write-Host "        $($_.name): $($_.messages) msgs" -ForegroundColor Cyan }
} else {
    Write-Host "    NO QUEUES" -ForegroundColor Red
}

# MongoDB
Write-Host "[3] MongoDB:" -ForegroundColor Yellow
$cmd = "db=db.getSiblingDB('BlinkrReadModel');db.auth('blinkr_re','blinkr123');db.posts.findOne({'_id':'$PostId'})?print('OK'):print('NOT FOUND');"
$result = $cmd | docker exec -i blinkr_mongodb mongosh --quiet 2>$null
if ($result -match "OK") {
    Write-Host "    OK - Post found!" -ForegroundColor Green
} else {
    Write-Host "    NOT FOUND" -ForegroundColor Red
}
