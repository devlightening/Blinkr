# Check MongoDB posts collection
Write-Host "Checking Docker MongoDB..." -ForegroundColor Yellow

# Check Docker MongoDB
docker exec blinkr_mongodb mongosh BlinkrReadModel --quiet --eval "db.posts.countDocuments()" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker MongoDB count:" -ForegroundColor Green
    docker exec blinkr_mongodb mongosh BlinkrReadModel --quiet --eval "db.posts.find().limit(5).pretty()"
} else {
    Write-Host "Docker MongoDB not accessible" -ForegroundColor Red
}

Write-Host "`nChecking localhost MongoDB (if exists)..." -ForegroundColor Yellow

# Try to check if mongosh is available locally
$mongoshExists = Get-Command mongosh -ErrorAction SilentlyContinue
if ($mongoshExists) {
    Write-Host "Local MongoDB count:" -ForegroundColor Green
    mongosh "mongodb://localhost:27017/BlinkrReadModel" --quiet --eval "db.posts.countDocuments()"
    mongosh "mongodb://localhost:27017/BlinkrReadModel" --quiet --eval "db.posts.find().limit(5).pretty()"
} else {
    Write-Host "mongosh not installed locally - checking via Docker only" -ForegroundColor Yellow
}

Write-Host "`nDone!" -ForegroundColor Green
