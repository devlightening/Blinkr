@echo off
echo 🚀 Android Emulator oluşturuluyor...
echo.

echo 📱 Mevcut system images kontrol ediliyor...
"%USERPROFILE%\AppData\Local\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" --list | findstr "system-images"

echo.
echo 📥 Android 14 (API 34) system image indiriliyor...
"%USERPROFILE%\AppData\Local\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" "system-images;android-34;google_apis;x86_64"

echo.
echo 📱 Emulator (AVD) oluşturuluyor...
"%USERPROFILE%\AppData\Local\Android\Sdk\cmdline-tools\latest\bin\avdmanager.bat" create avd -n Blinkr_Pixel_API34 -k "system-images;android-34;google_apis;x86_64" -d pixel_6

echo.
echo ✅ Emulator oluşturuldu! Başlatmak için:
echo "%USERPROFILE%\AppData\Local\Android\Sdk\emulator\emulator.exe" -avd Blinkr_Pixel_API34
echo.
pause
