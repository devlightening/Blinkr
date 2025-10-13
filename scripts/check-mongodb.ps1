# MongoDB check script - Verify post projection

param(
    [string]$PostId = "437d66ac-9dca-45d7-a42d-3f1de32ff751"
)

Write-Host "[INFO] Checking MongoDB for PostId: $PostId" -ForegroundColor Cyan

$mongoCommand = @"
db = db.getSiblingDB('BlinkrReadModel');
db.auth('blinkr_re', 'blinkr123');

print('[INFO] Searching for PostId: $PostId');
print('');

var doc = db.posts.findOne({'_id': '$PostId'});

if (doc) {
    print('[SUCCESS] Post found in MongoDB Read Model!');
    print('');
    print('=== POST DETAILS ===');
    printjson(doc);
} else {
    print('[WARNING] Post NOT found in MongoDB');
    print('');
    print('[INFO] Total posts in collection: ' + db.posts.countDocuments({}));
    print('[INFO] Recent posts:');
    db.posts.find().sort({createdAtUtc: -1}).limit(3).forEach(function(p) {
        print('  - ' + p._id + ' | ' + p.title);
    });
}
"@

$mongoResult = $mongoCommand | docker exec -i blinkr_mongodb mongosh --quiet

Write-Host $mongoResult
Write-Host ""
Write-Host "[COMPLETE] MongoDB check finished" -ForegroundColor Cyan
