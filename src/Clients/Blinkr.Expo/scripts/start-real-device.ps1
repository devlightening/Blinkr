param(
    [string]$LanIp,
    [int]$GatewayPort = 5080,
    [int]$MetroPort = 8083
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($LanIp)) {
    # Only adapters that are really up and not virtual: a disconnected Wi-Fi keeps a "Deprecated" address, and the
    # VirtualBox host-only adapter is called "Ethernet 2" - either one gives the phone an address it cannot reach.
    $upAdapters = Get-NetAdapter |
        Where-Object { $_.Status -eq "Up" -and $_.InterfaceDescription -notmatch "VirtualBox|VMware|Hyper-V|TAP-Windows|Virtual" } |
        Select-Object -ExpandProperty ifIndex
    $candidate = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $upAdapters -contains $_.InterfaceIndex -and
            $_.AddressState -eq "Preferred" -and
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
# Metro advertises the same address (otherwise Expo picks its own LAN interface, which can differ).
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $LanIp
Write-Host "Blinkr Expo API => $env:EXPO_PUBLIC_BLINKR_API_URL"
Write-Host "Blinkr Expo Metro => exp://${LanIp}:${MetroPort}"
Write-Host "Physical devices must be on the same Wi-Fi/LAN as this machine."

npx expo start --lan -c --port $MetroPort
