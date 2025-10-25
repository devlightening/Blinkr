# 🧪 Geospatial Feature Smoke Test

## 1️⃣ MongoDB Index Deployment
```bash
# Deploy 2dsphere index
mongosh < create-geo-indexes.js

# Verify index exists
mongosh --eval "db.getSiblingDB('BlinkrReadModel').posts.getIndexes()"
```

## 2️⃣ API Smoke Tests

### Test Coordinates (Istanbul, Turkey)
- **Taksim Square:** lat=41.0369, lon=28.9850
- **Galata Tower:** lat=41.0256, lon=28.9744
- **Bosphorus Bridge:** lat=41.0400, lon=29.0158

### Basic Nearby Query
```bash
# Test nearby posts (5km radius)
curl "https://localhost:7259/api/posts/nearby?lat=41.0369&lon=28.9850&radius=5000&page=1&pageSize=10"

# Expected: 200 OK with DistanceMeters field
```

### Validation Tests
```bash
# Invalid latitude (should return 400)
curl "https://localhost:7259/api/posts/nearby?lat=91&lon=28.9850&radius=5000"

# Invalid longitude (should return 400)  
curl "https://localhost:7259/api/posts/nearby?lat=41.0369&lon=181&radius=5000"
```

### Cache Test
```bash
# First call (cache miss)
curl -w "Time: %{time_total}s\n" "https://localhost:7259/api/posts/nearby?lat=41.0369&lon=28.9850&radius=5000"

# Second call (cache hit - should be faster)
curl -w "Time: %{time_total}s\n" "https://localhost:7259/api/posts/nearby?lat=41.0369&lon=28.9850&radius=5000"
```

## 3️⃣ MongoDB Query Performance Check
```javascript
// Check index usage
db.getSiblingDB("BlinkrReadModel").posts.aggregate([
  {
    $geoNear: {
      near: { type: "Point", coordinates: [28.9850, 41.0369] },
      distanceField: "distance",
      maxDistance: 5000,
      minDistance: 1,
      spherical: true
    }
  },
  { $limit: 10 }
]).explain("executionStats")

// Should show: "indexName": "ix_posts_location_2dsphere"
```

## 4️⃣ Worker Event Test
```bash
# 1. Create a post first
POST /api/posts
{
  "title": "Test Location Post",
  "content": "Testing geospatial features"
}

# 2. Add location (when command handlers are implemented)
POST /api/posts/{postId}/location
{
  "latitude": 41.0369,
  "longitude": 28.9850,
  "locationName": "Taksim Square, Istanbul"
}

# 3. Check worker logs for projection
# Expected: "📍 LocationAdded projected"

# 4. Verify in MongoDB
db.getSiblingDB("BlinkrReadModel").posts.findOne(
  { _id: "POST_ID" }, 
  { Location: 1, LocationName: 1 }
)
```

## ✅ Success Criteria
- [ ] 2dsphere index exists and is used
- [ ] Nearby API returns posts with DistanceMeters
- [ ] Results are sorted by distance (ascending)
- [ ] Invalid coordinates return 400 BadRequest
- [ ] Cache hit improves response time
- [ ] Worker projects location events successfully
- [ ] MongoDB queries use geospatial index (IXSCAN in explain)
