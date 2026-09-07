param(
    [switch]$SkipDockerBuild
)

$arguments = @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "start-blinkr-dev.ps1"))
if ($SkipDockerBuild) { $arguments += "-SkipDockerBuild" }
& powershell @arguments
exit $LASTEXITCODE
