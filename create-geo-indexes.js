// MongoDB Geospatial Index Creation Script
// Run this once: mongosh < create-geo-indexes.js

db = db.getSiblingDB("BlinkrReadModel");

// Create 2dsphere index for location-based queries
db.posts.createIndex(
  { Location: "2dsphere" }, 
  { 
    name: "ix_posts_location_2dsphere",
    background: true,
    sparse: true  // Only index documents that have Location field
  }
);

print("✅ Created 2dsphere index on posts.Location");

// Optional: Compound index for location + other filters
db.posts.createIndex(
  { Location: "2dsphere", CreatedAtUtc: -1 }, 
  { 
    name: "ix_posts_location_created",
    background: true,
    sparse: true
  }
);

print("✅ Created compound index on posts.Location + CreatedAtUtc");

// Verify indexes
print("\n📋 Current indexes on posts collection:");
db.posts.getIndexes().forEach(idx => {
  print(`- ${idx.name}: ${JSON.stringify(idx.key)}`);
});
