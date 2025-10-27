@echo off
echo 📱 GERÇEK CİHAZ TESTİ
echo.

echo 📋 JDK 17 aktif...
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.16.8-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%

echo 📋 Android SDK yolları...
set ANDROID_SDK_ROOT=%USERPROFILE%\AppData\Local\Android\Sdk
set PATH=%ANDROID_SDK_ROOT%\platform-tools;%PATH%

echo.
echo 📱 Android cihazları kontrol...
"%ANDROID_SDK_ROOT%\platform-tools\adb.exe" devices

echo.
echo 🔧 Eğer cihaz görünmüyorsa:
echo 1. USB Debugging açın (Developer Options)
echo 2. USB kablosunu değiştirin
echo 3. MTP/File Transfer modunu seçin
echo.

echo 📋 MAUI projesine git...
cd /d "C:\Users\hy971\source\repos\Blinkr\Blinkr\src\Clients\Blinkr.Mobile"

echo.
echo 🏗️ Android build...
dotnet clean
dotnet restore
dotnet build -f net9.0-android

echo.
echo 🚀 Cihaza deploy...
dotnet build -t:Run -f net9.0-android

pause
