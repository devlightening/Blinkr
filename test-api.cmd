@echo off
echo 🏥 Testing Health Endpoint...
curl -s "http://localhost:5215/health"
echo.

echo 📍 Testing Nearby Endpoint...
curl -s "http://localhost:5215/api/posts-read/nearby?lat=41.0082&lon=28.9784&radius=5000"
echo.

echo 📊 Testing with Headers...
curl -s -D - "http://localhost:5215/api/posts-read/nearby?lat=41.0082&lon=28.9784&radius=5000" -o NUL
echo.

echo ✅ API Tests Complete!
