$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Push-Location $repo
try {
    & powershell -ExecutionPolicy Bypass -File scripts/status-blinkr-dev.ps1
    if ($LASTEXITCODE -ne 0) { throw 'Stack must be healthy before acceptance tests.' }
    & dotnet run --project tests/PlacePosting/PlacePosting.csproj -- --catalog
    if ($LASTEXITCODE -ne 0) { throw 'Policy/catalog tests failed.' }
    foreach ($script in @('test-place-posting-real-catalog', 'test-nearby-distance-contract', 'test-nearby-place-ux-core', 'test-location-map-core', 'test-place-live-signal', 'test-content-media-smoke', 'test-auth-gateway-smoke', 'test-chat-smoke', 'test-author-posts-privacy')) {
        & powershell -ExecutionPolicy Bypass -File "scripts/$script.ps1"
        if ($LASTEXITCODE -ne 0) { throw "$script failed." }
    }
    Push-Location src/Clients/Blinkr.Expo
    try {
        foreach ($task in @('typecheck', 'test:theme', 'test:nearby', 'test:product', 'test:ui')) {
            & npm.cmd run $task
            if ($LASTEXITCODE -ne 0) { throw "$task failed." }
        }
    } finally { Pop-Location }
    Write-Host 'PASS automated product acceptance; PHYSICAL_RETEST_REQUIRED'
} finally { Pop-Location }
