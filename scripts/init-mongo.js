// MongoDB BlinkrReadModel database ve kullanıcı oluşturma scripti
// Kullanım: docker exec -i blinkr_mongodb mongosh -u mongoadmin -p secret --authenticationDatabase admin < scripts/init-mongo.js

// BlinkrReadModel database'ine geç
db = db.getSiblingDB('BlinkrReadModel');

// blinkr_re kullanıcısını oluştur (varsa sil ve yeniden oluştur)
try {
    db.dropUser('blinkr_re');
    print('🗑️ Eski kullanıcı silindi');
} catch (e) {
    print('⚠️ Kullanıcı bulunamadı, yeni oluşturulacak');
}

db.createUser({
    user: 'blinkr_re',
    pwd: 'blinkr123',
    roles: [
        {
            role: 'readWrite',
            db: 'BlinkrReadModel'
        }
    ]
});

print('✅ Kullanıcı blinkr_re oluşturuldu');

// posts collection'ını oluştur (opsiyonel, ilk insert'te otomatik oluşur)
db.createCollection('posts');
print('✅ posts collection oluşturuldu');

// Test dokümanı ekle
db.posts.insertOne({
    _id: '00000000-0000-0000-0000-000000000000',
    authorId: '00000000-0000-0000-0000-000000000000',
    title: 'Test Post',
    content: 'MongoDB bağlantısı test ediliyor',
    createdAtUtc: new Date(),
    likeCount: 0,
    comments: [],
    media: []
});

print('✅ Test dokümanı eklendi');
print('✅ BlinkrReadModel hazır!');
