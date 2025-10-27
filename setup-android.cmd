@echo off
echo 🔍 JDK 17 kurulum yolunu buluyoruz...
dir "C:\Program Files\Microsoft" | findstr jdk

echo.
echo 📁 Android SDK klasörü oluşturuluyor...
if not exist "C:\Android\Sdk" mkdir "C:\Android\Sdk"
if not exist "C:\Android\Sdk\cmdline-tools" mkdir "C:\Android\Sdk\cmdline-tools"

echo.
echo 🔧 Environment Variables ayarlanıyor...
setx JAVA_HOME "C:\Program Files\Microsoft\jdk-17.0.16.8-hotspot"
setx ANDROID_SDK_ROOT "C:\Android\Sdk"
setx ANDROID_HOME "C:\Android\Sdk"

echo.
echo 📝 PATH güncelleniyor...
setx PATH "%PATH%;%JAVA_HOME%\bin;C:\Android\Sdk\platform-tools;C:\Android\Sdk\emulator;C:\Android\Sdk\cmdline-tools\latest\bin"

echo.
echo ✅ Kurulum tamamlandı! Yeni terminal açın ve devam edin.
pause
