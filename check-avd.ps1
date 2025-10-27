# Check and create AVD
$env:ANDROID_SDK_ROOT = "$env:USERPROFILE\AppData\Local\Android\Sdk"
$emulatorPath = "$env:ANDROID_SDK_ROOT\emulator\emulator.exe"

Write-Host "Checking existing AVDs..."
& $emulatorPath -list-avds

Write-Host "`nChecking available system images..."
& "$env:ANDROID_SDK_ROOT\cmdline-tools\latest\bin\sdkmanager.bat" --list | Select-String "system-images.*android-34.*x86_64"
