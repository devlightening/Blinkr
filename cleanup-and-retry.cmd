@echo off
echo 🧹 TEMIZLIK VE TEKRAR KURULUM
echo.

echo 📋 JDK 17 aktif...
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.16.8-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%

echo 📋 Android SDK yolları...
set ANDROID_SDK_ROOT=%USERPROFILE%\AppData\Local\Android\Sdk
set PATH=%ANDROID_SDK_ROOT%\platform-tools;%ANDROID_SDK_ROOT%\emulator;%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin;%PATH%

echo.
echo 🧹 Mevcut system-images kontrol...
dir "%ANDROID_SDK_ROOT%\system-images" 2>nul

echo.
echo 🧹 Temp dosyaları temizle...
rmdir /s /q "%ANDROID_SDK_ROOT%\.temp" 2>nul
rmdir /s /q "%ANDROID_SDK_ROOT%\.downloadIntermediates" 2>nul

echo.
echo 📋 Disk alanı kontrol...
dir "%ANDROID_SDK_ROOT%"

echo.
echo 📦 Sadece gerekli paketleri kur (minimal)...
"%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat" --list | findstr "system-images"

echo.
echo 📦 API 34 minimal kurulum...
"%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat" "system-images;android-34;default;x86_64"

echo.
echo 📱 AVD oluştur (default image - daha küçük)...
"%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\avdmanager.bat" create avd -n Blinkr_Minimal -k "system-images;android-34;default;x86_64" -d pixel_6

echo.
echo 🚀 Emülatörü başlat...
start "Android Emulator" "%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd Blinkr_Minimal

echo.
echo ✅ Minimal emulator kurulumu tamamlandı!
pause
