param(
    [switch]$Infrastructure
)

$arguments = @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "stop-blinkr-dev.ps1"))
if ($Infrastructure) { $arguments += "-Infrastructure" }
& powershell @arguments
exit $LASTEXITCODE
