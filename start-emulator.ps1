# Start Android Emulator
$env:ANDROID_SDK_ROOT = "$env:USERPROFILE\AppData\Local\Android\Sdk"
$emulatorPath = "$env:ANDROID_SDK_ROOT\emulator\emulator.exe"

Write-Host "Starting emulator: Medium_Phone_API_36.1"
Write-Host "This will take 30-90 seconds to boot..."

# Start emulator in background
Start-Process -FilePath $emulatorPath -ArgumentList "-avd", "Medium_Phone_API_36.1", "-netdelay", "none", "-netspeed", "full" -WindowStyle Normal

Write-Host "Emulator starting... Please wait for Android home screen to appear."
Write-Host "Then run the deploy script."
