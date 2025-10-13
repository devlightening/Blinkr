# MongoDB setup script - BlinkrReadModel database ve blinkr_re kullanicisini olusturur

Write-Host "[INFO] MongoDB setup baslatiliyor..." -ForegroundColor Cyan

# MongoDB container'inin calistigini kontrol et
$containerStatus = docker ps --filter "name=blinkr_mongodb" --format "{{.Status}}"
if (-not $containerStatus) {
    Write-Host "[ERROR] blinkr_mongodb container'i calismiyor!" -ForegroundColor Red
    Write-Host "Lutfen once 'docker-compose up -d' komutunu calistirin." -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] MongoDB container calisiyor: $containerStatus" -ForegroundColor Green

# Init script'i calistir
Write-Host "[INFO] BlinkrReadModel database ve kullanici olusturuluyor..." -ForegroundColor Cyan

$scriptPath = "$PSScriptRoot\init-mongo.js"
$result = Get-Content $scriptPath | docker exec -i blinkr_mongodb mongosh -u mongoadmin -p secret --authenticationDatabase admin

Write-Host $result

# Baglantıyı test et
Write-Host ""
Write-Host "[INFO] Kullanici baglantisi test ediliyor..." -ForegroundColor Cyan

$testCommand = @"
db = db.getSiblingDB('BlinkrReadModel');
db.auth('blinkr_re', 'blinkr123');
print('[OK] Authentication basarili!');
db.posts.countDocuments({});
"@

$testResult = $testCommand | docker exec -i blinkr_mongodb mongosh --quiet

Write-Host $testResult

Write-Host ""
Write-Host "[SUCCESS] MongoDB setup tamamlandi!" -ForegroundColor Green
$connString = "mongodb://blinkr_re:blinkr123@localhost:27017/?authSource=BlinkrReadModel&authMechanism=SCRAM-SHA-256"
Write-Host "[INFO] Connection String: $connString" -ForegroundColor Cyan
