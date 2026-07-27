param(
    [string]$LanIp,
    [int]$GatewayPort = 5080,
    [int]$MetroPort = 8083
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($LanIp)) {
    $candidate = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*" -and
            $_.InterfaceAlias -notmatch "vEthernet|Virtual|Default Switch|WSL|Loopback|Cloudflare|WARP|Docker"
        } |
        Sort-Object { if ($_.InterfaceAlias -match "Wi-Fi|Ethernet") { 0 } else { 1 } } |
        Select-Object -First 1

    if ($null -eq $candidate) {
        throw "LAN IPv4 address could not be detected. Pass -LanIp manually."
    }

    $LanIp = $candidate.IPAddress
}

$env:EXPO_PUBLIC_BLINKR_API_URL = "http://${LanIp}:${GatewayPort}"
Write-Host "Blinkr Expo API => $env:EXPO_PUBLIC_BLINKR_API_URL"
Write-Host "Blinkr Expo Metro => exp://${LanIp}:${MetroPort}"
Write-Host "Physical devices must be on the same Wi-Fi/LAN as this machine."

npx expo start --lan -c --port $MetroPort
