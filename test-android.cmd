@echo off
echo 🔍 Android cihazları kontrol ediliyor...
"%USERPROFILE%\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices

echo.
echo 📱 MAUI Android uygulamasını test ediyoruz...
cd /d "C:\Users\hy971\source\repos\Blinkr\Blinkr\src\Clients\Blinkr.Mobile"

echo.
echo 🏗️ Android build...
dotnet build -f net9.0-android

echo.
echo 🚀 Eğer cihaz bağlıysa uygulamayı yükleyip çalıştırıyoruz...
dotnet build -t:Run -f net9.0-android

pause
