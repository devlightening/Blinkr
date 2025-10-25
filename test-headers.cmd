@echo off
echo 🧪 RATE LIMITING HEADER TEST
echo ============================

echo.
echo 📋 TEST 1: Single Request Headers
curl -s -D - "http://localhost:5215/api/posts-read/nearby?lat=41.0082&lon=28.9784&radius=5000" -o NUL

echo.
echo 🔥 TEST 2: Burst Test (10 requests)
for /l %%i in (1,1,10) do (
    curl -s -o NUL -w "Request %%i: HTTP:%%{http_code}\n" "http://localhost:5215/api/posts-read/nearby?lat=41.0082&lon=28.9784&radius=5000"
)

echo.
echo 🏥 TEST 3: Health Check (should bypass)
curl -s -D - "http://localhost:5215/health" -o NUL

echo.
echo ✅ Tests completed!
