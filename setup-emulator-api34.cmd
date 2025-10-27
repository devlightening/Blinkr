@echo off
echo 🔥 API 34 ile emulator kurulumu (daha az disk alanı)
echo.

echo 📋 JDK 17 aktif...
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.16.8-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%

echo 📋 Android SDK yolları...
set ANDROID_SDK_ROOT=%USERPROFILE%\AppData\Local\Android\Sdk
set PATH=%ANDROID_SDK_ROOT%\platform-tools;%ANDROID_SDK_ROOT%\emulator;%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin;%PATH%

echo.
echo 📋 Disk alanı kontrol...
dir "%ANDROID_SDK_ROOT%" 2>nul || echo Android SDK klasoru bulunamadi!

echo.
echo 📋 Minimal paketler (API 34 - daha küçük)...
"%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat" "platforms;android-34" "build-tools;34.0.0" "system-images;android-34;google_apis;x86_64"

echo.
echo 📋 AVD oluştur (API 34)...
"%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\avdmanager.bat" create avd -n Blinkr_API_34 -k "system-images;android-34;google_apis;x86_64" -d pixel_6

echo.
echo 📋 Emülatörü başlat...
start "Android Emulator" "%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd Blinkr_API_34

echo.
echo ✅ API 34 emulator başlatıldı!
echo Şimdi MAUI uygulamasını test edelim...
pause
