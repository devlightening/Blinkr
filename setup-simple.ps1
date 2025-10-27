# Simple Android Environment Setup
Write-Host "Setting up Android development environment..."

# Set environment variables
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.16.8-hotspot"
$env:ANDROID_SDK_ROOT = "$env:USERPROFILE\AppData\Local\Android\Sdk"
$env:ANDROID_HOME = $env:ANDROID_SDK_ROOT

# Update PATH step by step
$javaPath = "$env:JAVA_HOME\bin"
$platformTools = "$env:ANDROID_SDK_ROOT\platform-tools"
$emulatorPath = "$env:ANDROID_SDK_ROOT\emulator"
$cmdlineTools = "$env:ANDROID_SDK_ROOT\cmdline-tools\latest\bin"

$env:Path = $javaPath + ";" + $platformTools + ";" + $emulatorPath + ";" + $cmdlineTools + ";" + $env:Path

Write-Host "Environment variables set:"
Write-Host "JAVA_HOME: $env:JAVA_HOME"
Write-Host "ANDROID_SDK_ROOT: $env:ANDROID_SDK_ROOT"

# Test ADB
Write-Host "Testing ADB..."
try {
    & adb version
    Write-Host "ADB is working!"
} catch {
    Write-Host "ADB not found"
}

# Start ADB server
Write-Host "Starting ADB server..."
& adb start-server

# Check devices
Write-Host "Checking devices..."
& adb devices
