# MongoDB Indexes Creation Script
# Run this in PowerShell

Write-Host "🎯 Creating MongoDB indexes for posts collection..." -ForegroundColor Green

# Check if MongoDB is running
$mongoService = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
if (-not $mongoService -or $mongoService.Status -ne 'Running') {
    Write-Host "❌ MongoDB service not running. Please start MongoDB first." -ForegroundColor Red
    exit 1
}

# MongoDB commands as array
$mongoCommands = @(
    'use BlinkrReadModel;',
    'print("Creating indexes for posts collection...");',
    'db.posts.createIndex({ CreatedAtUtc: -1 }, { name: "ix_posts_createdAt_desc", background: true });',
    'print("✅ Created index: ix_posts_createdAt_desc");',
    'db.posts.createIndex({ AuthorId: 1, CreatedAtUtc: -1 }, { name: "ix_posts_author_createdAt", background: true });',
    'print("✅ Created index: ix_posts_author_createdAt");',
    'db.posts.createIndex({ Title: "text", Content: "text" }, { name: "ix_posts_text_search", default_language: "english", background: true, weights: { Title: 10, Content: 1 } });',
    'print("✅ Created index: ix_posts_text_search");',
    'db.posts.createIndex({ LikeCount: -1, CreatedAtUtc: -1 }, { name: "ix_posts_likeCount_desc", background: true });',
    'print("✅ Created index: ix_posts_likeCount_desc");',
    'db.posts.createIndex({ AuthorId: 1, LikeCount: -1, CreatedAtUtc: -1 }, { name: "ix_posts_author_likes_created", background: true });',
    'print("✅ Created index: ix_posts_author_likes_created");',
    'print("📊 Listing all indexes on posts collection:");',
    'db.posts.getIndexes().forEach(function(index) { print("- " + index.name + ": " + JSON.stringify(index.key)); });',
    'print("🎯 Index creation completed!");'
)

# Join commands with semicolon
$mongoScript = $mongoCommands -join ' '

try {
    Write-Host "🔄 Connecting to MongoDB on localhost:27017..." -ForegroundColor Yellow
    
    # Try mongosh first (newer MongoDB shell)
    $result = & mongosh --quiet --eval $mongoScript 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host $result -ForegroundColor Green
        Write-Host "🎉 Indexes created successfully with mongosh!" -ForegroundColor Green
        exit 0
    }
    
    # Fallback to mongo (older shell)
    Write-Host "⚠️ mongosh not found, trying mongo shell..." -ForegroundColor Yellow
    $result = & mongo --quiet --eval $mongoScript 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host $result -ForegroundColor Green
        Write-Host "🎉 Indexes created successfully with mongo!" -ForegroundColor Green
        exit 0
    }
    
    Write-Host "❌ Neither mongosh nor mongo shell found." -ForegroundColor Red
    Write-Host "💡 Please install MongoDB shell or use MongoDB Compass instead." -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Error creating indexes: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Try using MongoDB Compass instead." -ForegroundColor Yellow
}

Write-Host "`n📝 Manual alternative:" -ForegroundColor Cyan
Write-Host "1. Download MongoDB Compass: https://www.mongodb.com/try/download/compass" -ForegroundColor White
Write-Host "2. Connect to: mongodb://localhost:27017" -ForegroundColor White
Write-Host "3. Go to BlinkrReadModel database" -ForegroundColor White
Write-Host "4. Go to posts collection" -ForegroundColor White
Write-Host "5. Click 'Indexes' tab and create indexes manually" -ForegroundColor White
