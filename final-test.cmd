@echo off
echo 🚀 FINAL TEST - MAUI ANDROID EMULATOR
echo.

echo 📋 Environment setup...
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.16.8-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
set ANDROID_SDK_ROOT=%USERPROFILE%\AppData\Local\Android\Sdk
set PATH=%ANDROID_SDK_ROOT%\platform-tools;%ANDROID_SDK_ROOT%\emulator;%PATH%

echo.
echo 📱 Emulator durumu kontrol...
"%ANDROID_SDK_ROOT%\platform-tools\adb.exe" devices

echo.
echo 📱 Eğer emulator çalışmıyorsa başlat...
start "Android Emulator" "%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd Blinkr_Minimal

echo.
echo ⏳ Emulator açılmasını bekleyin (2-3 dakika)...
echo Emulator açıldıktan sonra Enter'a basın...
pause

echo.
echo 🏗️ MAUI Android build ve deploy...
cd /d "C:\Users\hy971\source\repos\Blinkr\Blinkr\src\Clients\Blinkr.Mobile"

echo.
echo 🧹 Clean build...
dotnet clean

echo.
echo 📦 Restore packages...
dotnet restore

echo.
echo 🔨 Build Android...
dotnet build -f net9.0-android

echo.
echo 🚀 Deploy to emulator...
dotnet build -t:Run -f net9.0-android

echo.
echo ✅ Test tamamlandı!
pause
