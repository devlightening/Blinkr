# Android Development Environment Setup
Write-Host "🔧 Setting up Android development environment..." -ForegroundColor Green

# Set environment variables
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.16.8-hotspot"
$env:ANDROID_SDK_ROOT = "$env:USERPROFILE\AppData\Local\Android\Sdk"
$env:ANDROID_HOME = $env:ANDROID_SDK_ROOT

# Update PATH
$javaPath = "$env:JAVA_HOME\bin"
$platformTools = "$env:ANDROID_SDK_ROOT\platform-tools"
$emulatorPath = "$env:ANDROID_SDK_ROOT\emulator"
$cmdlineTools = "$env:ANDROID_SDK_ROOT\cmdline-tools\latest\bin"
$env:Path = "$javaPath;$platformTools;$emulatorPath;$cmdlineTools;$env:Path"

Write-Host "✅ Environment variables set:" -ForegroundColor Green
Write-Host "   JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Yellow
Write-Host "   ANDROID_SDK_ROOT: $env:ANDROID_SDK_ROOT" -ForegroundColor Yellow
Write-Host "   ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Yellow

# Test ADB
Write-Host "`n🔍 Testing ADB..." -ForegroundColor Green
try {
    adb version
    Write-Host "✅ ADB is working!" -ForegroundColor Green
} catch {
    Write-Host "❌ ADB not found in PATH" -ForegroundColor Red
}

# Start ADB server
Write-Host "`n🚀 Starting ADB server..." -ForegroundColor Green
adb start-server

# Check devices
Write-Host "`n📱 Checking connected devices..." -ForegroundColor Green
adb devices

Write-Host "`n✅ Environment setup complete!" -ForegroundColor Green
