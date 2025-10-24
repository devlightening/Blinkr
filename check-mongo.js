// MongoDB check script
const db = db.getSiblingDB('BlinkrReadModel');
print('=== BlinkrReadModel.posts ===');
print('Count:', db.posts.countDocuments());
print('\nLatest 5 posts:');
db.posts.find().sort({CreatedAtUtc: -1}).limit(5).forEach(doc => {
  print('- PostId:', doc.Id, '| Title:', doc.Title, '| CreatedAt:', doc.CreatedAtUtc);
});
