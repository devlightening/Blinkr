param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-MEDIA-PRIVACY-01: a photo's hidden metadata (EXIF with GPS position, PNG/WebP text and EXIF chunks) never
# reaches the stored file that other people download (sinyal-mvp-plan Faz 5 kabul: "yüklenen dosyada EXIF GPS yok").

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

function Ascii([string]$Text) { [System.Text.Encoding]::ASCII.GetBytes($Text) }
function Contains-Bytes([byte[]]$Haystack, [byte[]]$Needle) {
    for ($i = 0; $i -le $Haystack.Length - $Needle.Length; $i++) {
        $match = $true
        for ($j = 0; $j -lt $Needle.Length; $j++) { if ($Haystack[$i + $j] -ne $Needle[$j]) { $match = $false; break } }
        if ($match) { return $true }
    }
    return $false
}

function Upload-And-Fetch {
    param([string]$Token, [string]$ContentType, [byte[]]$Bytes, [string]$FileName)
    $headers = @{ Authorization = "Bearer $Token" }
    $presign = Invoke-RestMethod -Method POST -Uri "$GatewayBaseUrl/api/v1/media/presign" -Headers $headers -ContentType "application/json" -Body (@{ fileName = $FileName; contentType = $ContentType; sizeBytes = $Bytes.Length; width = 1; height = 1 } | ConvertTo-Json)
    $uploadUrl = $presign.uploadUrl
    if ($uploadUrl.StartsWith("/")) { $uploadUrl = "$GatewayBaseUrl$uploadUrl" }
    Invoke-WebRequest -Method PUT -Uri $uploadUrl -Headers $headers -ContentType $ContentType -Body $Bytes -UseBasicParsing -TimeoutSec 30 | Out-Null
    # Only media attached to a post is public; attach it to a coordinate signal.
    $post = @{ title = ""; content = "Media privacy smoke"; signalType = "GeneralObservation"; latitude = 37.0746; longitude = 36.2464; accuracyMeters = 25; locationName = "Osmaniye"; audienceType = "Public"; identityDisclosure = "LimitedProfile"; locationPrecision = "ApproximateArea"; media = @(@{ mediaId = $presign.mediaId; mediaType = "Image" }) }
    Invoke-RestMethod -Method POST -Uri "$GatewayBaseUrl/api/posts" -Headers $headers -ContentType "application/json" -Body ($post | ConvertTo-Json -Depth 5) | Out-Null
    $publicUrl = "$GatewayBaseUrl/api/v1/media/public/$($presign.mediaId)"
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        Invoke-WebRequest -Uri $publicUrl -Headers $headers -OutFile $tmp -UseBasicParsing -TimeoutSec 30 | Out-Null
        return [System.IO.File]::ReadAllBytes($tmp)
    } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

Write-Host "BLK-MEDIA-PRIVACY-01 metadata stripping via $GatewayBaseUrl"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$reg = Invoke-RestMethod -Method POST -Uri "$GatewayBaseUrl/api/auth/register" -ContentType "application/json" -Body (@{ userName = "mp_$suffix"; email = "mp_$suffix@blinkr.local"; password = "BlinkrSmoke!2026" } | ConvertTo-Json)
$token = $reg.token
$gps = Ascii "GPSLatitude=39.9208"

# JPEG: SOI, APP1 "Exif" segment carrying a fake GPS payload, a DQT segment, SOS + data, EOI.
$app1Payload = (Ascii "Exif") + [byte[]](0, 0) + $gps
$app1Len = $app1Payload.Length + 2
$jpeg = [byte[]](0xFF, 0xD8, 0xFF, 0xE1, [byte]($app1Len -shr 8), [byte]($app1Len -band 0xFF)) + $app1Payload + [byte[]](0xFF, 0xDB, 0x00, 0x04, 0x00, 0x01, 0xFF, 0xDA, 0x00, 0x02, 0x11, 0x22, 0xFF, 0xD9)
$storedJpeg = Upload-And-Fetch -Token $token -ContentType "image/jpeg" -Bytes $jpeg -FileName "gps.jpg"
Check "JPEG keeps its picture" ($storedJpeg.Length -gt 0 -and $storedJpeg[0] -eq 0xFF -and $storedJpeg[1] -eq 0xD8 -and (Contains-Bytes $storedJpeg ([byte[]](0xFF, 0xDA))))
Check "JPEG EXIF/GPS is gone" (-not (Contains-Bytes $storedJpeg (Ascii "Exif")) -and -not (Contains-Bytes $storedJpeg $gps))

# PNG: signature, IHDR, an eXIf chunk and a tEXt chunk with the same payload, IEND. CRCs are not checked by the server.
function Png-Chunk([string]$Type, [byte[]]$Data) {
    $len = $Data.Length
    [byte[]]([byte]($len -shr 24), [byte](($len -shr 16) -band 0xFF), [byte](($len -shr 8) -band 0xFF), [byte]($len -band 0xFF)) + (Ascii $Type) + $Data + [byte[]](0, 0, 0, 0)
}
$png = [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) + (Png-Chunk "IHDR" ([byte[]](0,0,0,1,0,0,0,1,8,6,0,0,0))) + (Png-Chunk "eXIf" $gps) + (Png-Chunk "tEXt" ((Ascii "Location") + [byte[]](0) + $gps)) + (Png-Chunk "IEND" ([byte[]]@()))
$storedPng = Upload-And-Fetch -Token $token -ContentType "image/png" -Bytes $png -FileName "gps.png"
Check "PNG keeps IHDR and IEND" ((Contains-Bytes $storedPng (Ascii "IHDR")) -and (Contains-Bytes $storedPng (Ascii "IEND")))
Check "PNG eXIf/tEXt location is gone" (-not (Contains-Bytes $storedPng $gps) -and -not (Contains-Bytes $storedPng (Ascii "eXIf")))

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-MEDIA-PRIVACY-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    exit 1
}
Write-Host "`nPASS BLK-MEDIA-PRIVACY-01 metadata stripping"
