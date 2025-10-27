@echo off
echo 🔥 KOŞA KOŞA ÇALIŞTIRMA BAŞLIYOR!
echo.

echo 📋 ADIM 1: JDK 17'yi etkin yap...
set JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.16.8-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
java -version

echo.
echo 📋 ADIM 2: Android SDK yolları...
set ANDROID_SDK_ROOT=%USERPROFILE%\AppData\Local\Android\Sdk
set PATH=%ANDROID_SDK_ROOT%\platform-tools;%ANDROID_SDK_ROOT%\emulator;%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin;%PATH%

echo.
echo 📋 ADIM 3: Gerekli paketleri kur (API 35)...
"%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat" "cmdline-tools;latest" "platform-tools" "emulator" "platforms;android-35" "build-tools;35.0.0" "system-images;android-35;google_apis;x86_64"

echo.
echo 📋 Lisansları kabul et...
echo y | "%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\sdkmanager.bat" --licenses

echo.
echo 📋 ADIM 4: AVD (emülatör) oluştur...
"%ANDROID_SDK_ROOT%\cmdline-tools\latest\bin\avdmanager.bat" create avd -n Blinkr_API_35 -k "system-images;android-35;google_apis;x86_64" -d pixel_7

echo.
echo 📋 ADIM 5: Emülatörü başlat...
start "Android Emulator" "%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd Blinkr_API_35

echo.
echo ⏳ Emülatör açılmasını bekleyin (2-3 dakika)...
echo Sonra MAUI uygulamasını deploy edeceğiz!
pause
