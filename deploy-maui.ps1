# Deploy MAUI to Android Emulator
Write-Host "=== MAUI Android Deployment ==="

# Set environment
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.16.8-hotspot"
$env:ANDROID_SDK_ROOT = "$env:USERPROFILE\AppData\Local\Android\Sdk"
$env:ANDROID_HOME = $env:ANDROID_SDK_ROOT

$javaPath = "$env:JAVA_HOME\bin"
$platformTools = "$env:ANDROID_SDK_ROOT\platform-tools"
$emulatorPath = "$env:ANDROID_SDK_ROOT\emulator"
$cmdlineTools = "$env:ANDROID_SDK_ROOT\cmdline-tools\latest\bin"
$env:Path = $javaPath + ";" + $platformTools + ";" + $emulatorPath + ";" + $cmdlineTools + ";" + $env:Path

# Check devices
Write-Host "Checking connected devices..."
& adb devices

$devices = & adb devices
if ($devices -match "emulator-\d+\s+device") {
    Write-Host "✅ Emulator detected and ready!"
    
    # Navigate to project
    Set-Location "C:\Users\hy971\source\repos\Blinkr\Blinkr\src\Clients\Blinkr.Mobile"
    
    Write-Host "Cleaning project..."
    & dotnet clean
    
    Write-Host "Restoring packages..."
    & dotnet restore
    
    Write-Host "Building Android..."
    & dotnet build -f net9.0-android
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build successful! Deploying to emulator..."
        & dotnet build -t:Run -f net9.0-android
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "🎉 SUCCESS! Blinkr app deployed to emulator!"
        } else {
            Write-Host "❌ Deployment failed. Check the output above."
        }
    } else {
        Write-Host "❌ Build failed. Check the output above."
    }
} else {
    Write-Host "❌ No emulator device found. Make sure emulator is running and shows 'device' status."
    Write-Host "Current devices:"
    & adb devices
}
