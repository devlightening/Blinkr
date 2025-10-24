// MongoDB Indexes for Posts Collection
// Run this script in MongoDB shell or Mongo Express

use BlinkrReadModel;

print("Creating indexes for posts collection...");

// 1. CreatedAtUtc descending (for default sort - newest first)
db.posts.createIndex(
    { CreatedAtUtc: -1 }, 
    { 
        name: "ix_posts_createdAt_desc",
        background: true 
    }
);
print("✅ Created index: ix_posts_createdAt_desc");

// 2. AuthorId + CreatedAtUtc (for author timeline)
db.posts.createIndex(
    { AuthorId: 1, CreatedAtUtc: -1 }, 
    { 
        name: "ix_posts_author_createdAt",
        background: true 
    }
);
print("✅ Created index: ix_posts_author_createdAt");

// 3. Text search index (for title and content search)
db.posts.createIndex(
    { 
        Title: "text", 
        Content: "text" 
    }, 
    { 
        name: "ix_posts_text_search",
        default_language: "english",
        background: true,
        weights: {
            Title: 10,    // Title matches are more important
            Content: 1
        }
    }
);
print("✅ Created index: ix_posts_text_search");

// 4. LikeCount descending (for popular posts sort)
db.posts.createIndex(
    { LikeCount: -1, CreatedAtUtc: -1 }, 
    { 
        name: "ix_posts_likeCount_desc",
        background: true 
    }
);
print("✅ Created index: ix_posts_likeCount_desc");

// 5. Compound index for filtered queries (AuthorId + LikeCount + CreatedAt)
db.posts.createIndex(
    { AuthorId: 1, LikeCount: -1, CreatedAtUtc: -1 }, 
    { 
        name: "ix_posts_author_likes_created",
        background: true 
    }
);
print("✅ Created index: ix_posts_author_likes_created");

print("\n📊 Listing all indexes on posts collection:");
db.posts.getIndexes().forEach(function(index) {
    print("- " + index.name + ": " + JSON.stringify(index.key));
});

print("\n🎯 Index creation completed!");
print("💡 These indexes will improve query performance for:");
print("   • Default feed (newest first)");
print("   • Author timelines");
print("   • Text search in title/content");
print("   • Popular posts (by like count)");
print("   • Combined author + popularity queries");
