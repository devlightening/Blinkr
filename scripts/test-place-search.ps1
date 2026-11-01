param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-SEARCH-01: the map's "where to?" search. Text and everyday category words find Places around the map centre
# in a wide radius (up to 30 km), nearest first, with distance and live state; the composer's 1.5 km default is
# unchanged and bad input is refused.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Get-Search {
    param([string]$Query, [double]$Lat = 37.0742, [double]$Lon = 36.2478, $Radius = $null, [switch]$Expand)
    $uri = "$GatewayBaseUrl/api/places/search?q=$([uri]::EscapeDataString($Query))&lat=$Lat&lon=$Lon"
    if ($null -ne $Radius) { $uri += "&radiusMeters=$Radius" }
    if ($Expand) { $uri += "&expand=true" }
    $status = 0; $raw = ""
    try { $r = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 30; $status = [int]$r.StatusCode; $raw = [string]$r.Content }
    catch {
        $resp = $_.Exception.Response
        if ($null -eq $resp) { throw }
        $status = [int]$resp.StatusCode
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $raw = $reader.ReadToEnd(); $reader.Dispose()
    }
    $items = @()
    if ($status -eq 200 -and -not [string]::IsNullOrWhiteSpace($raw)) { $items = @($raw | ConvertFrom-Json | ForEach-Object { $_ }) }
    [pscustomobject]@{ Status = $status; Items = $items; Raw = $raw }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

Write-Host "BLK-SEARCH-01 map search via $GatewayBaseUrl"

$narrow = Get-Search -Query "eczane"
$wide = Get-Search -Query "eczane" -Radius 30000
Check "category word works with the default radius" ($narrow.Status -eq 200 -and $narrow.Items.Count -gt 0) "HTTP $($narrow.Status) count $($narrow.Items.Count)"
Check "the default radius stays at 1.5 km" (@($narrow.Items | Where-Object { $_.distanceMeters -gt 1600 }).Count -eq 0)
Check "a 30 km radius reaches further than the default" ($wide.Items.Count -gt $narrow.Items.Count -and ($wide.Items | Measure-Object distanceMeters -Maximum).Maximum -gt 1600) "narrow $($narrow.Items.Count) wide $($wide.Items.Count)"
Check "wide results are nearest first" ((@($wide.Items.distanceMeters) -join ',') -eq ((@($wide.Items.distanceMeters) | Sort-Object { [double]$_ }) -join ','))
Check "results carry distance, category and live state" ($wide.Items[0].distanceMeters -ge 0 -and $wide.Items[0].category -eq "PHARMACY" -and $null -ne $wide.Items[0].currentState)

$huge = Get-Search -Query "eczane" -Radius 9000000
Check "an oversized radius is clamped to 30 km, not rejected" ($huge.Status -eq 200 -and (($huge.Items | Measure-Object distanceMeters -Maximum).Maximum -le 30500))

foreach ($word in @("hastane", "kafe", "park", "market")) {
    $r = Get-Search -Query $word -Radius 30000
    Check "everyday word '$word' finds places" ($r.Status -eq 200 -and $r.Items.Count -gt 0) "HTTP $($r.Status) count $($r.Items.Count)"
}
$hospital = Get-Search -Query "hastane" -Radius 30000
Check "'hastane' maps to the HEALTH category" (@($hospital.Items | Where-Object { $_.category -ne "HEALTH" -and $_.name -notmatch "(?i)hastane" }).Count -eq 0)

$byName = Get-Search -Query "Kent" -Radius 30000
Check "a name fragment finds places by name" ($byName.Status -eq 200 -and $byName.Items.Count -gt 0 -and @($byName.Items | Where-Object { $_.name -match "(?i)kent" -or $_.displayAddress -match "(?i)kent" }).Count -gt 0)

$dottedI = [string][char]0x130
$turkish = Get-Search -Query ("ECZANES" + $dottedI) -Radius 30000
Check "Turkish capital dotted I still matches (ECZANES + U+0130)" ($turkish.Status -eq 200 -and $turkish.Items.Count -gt 0)

$none = Get-Search -Query "zzzqqqxxyy" -Radius 30000
Check "no match is an empty 200" ($none.Status -eq 200 -and $none.Items.Count -eq 0)

$long = Get-Search -Query ("a" * 81)
Check "a query over 80 characters is a 400" ($long.Status -eq 400)
$blank = Get-Search -Query "  "
Check "a blank query is a 400" ($blank.Status -eq 400)
$badOrigin = Get-Search -Query "kafe" -Lat 999 -Lon 36
Check "an impossible origin is a 400" ($badOrigin.Status -eq 400)

# ---- the map search never dead-ends: folding, joined words, nationwide fallback, typo rescue
$adana = @{ Lat = 37.0306; Lon = 35.3157 }   # a Soulmate cafe is right here
$istanbul = @{ Lat = 41.0082; Lon = 28.9784 }
$soul = Get-Search -Query 'soulmate' -Lat $adana.Lat -Lon $adana.Lon -Radius 30000 -Expand
Check 'a cafe 0-1 km away is found by its name and ranks first' ($soul.Items.Count -gt 0 -and $soul.Items[0].name -match '(?i)soulmate' -and $soul.Items[0].distanceMeters -lt 1500) "first: $($soul.Items[0].name) at $($soul.Items[0].distanceMeters) m"
$spaced = Get-Search -Query 'soul mate' -Lat $adana.Lat -Lon $adana.Lon -Radius 30000 -Expand
Check 'a query typed with a space finds a name written as one word' ($spaced.Items.Count -gt 0 -and @($spaced.Items | Where-Object { $_.name -match '(?i)soul\s*mate' }).Count -gt 0)
$upper = Get-Search -Query 'SOULMATE' -Lat $adana.Lat -Lon $adana.Lon -Radius 30000 -Expand
Check 'the query is case-insensitive' ($upper.Items.Count -eq $soul.Items.Count)
$sIfa = [string][char]0x15F
$noTurkish = Get-Search -Query 'sifa' -Radius 30000 -Expand
Check 'Turkish characters can be left out (sifa finds the pharmacy with a dotted name)' (@($noTurkish.Items | Where-Object { $_.name -match "(?i)(s|$sIfa)ifa" }).Count -gt 0) "count $($noTurkish.Items.Count)"
$far = Get-Search -Query 'soulmate' -Lat $istanbul.Lat -Lon $istanbul.Lon -Radius 30000 -Expand
Check 'when the neighbourhood has no match the whole catalogue is searched' ($far.Items.Count -gt 0 -and ($far.Items | Measure-Object distanceMeters -Maximum).Maximum -gt 100000) "count $($far.Items.Count)"
$plain = Get-Search -Query 'soulmate' -Lat $istanbul.Lat -Lon $istanbul.Lon -Radius 30000
Check 'without expand the search stays local (composer contract)' ($plain.Items.Count -eq 0)
$typo = Get-Search -Query 'soulmte' -Lat $adana.Lat -Lon $adana.Lon -Radius 30000 -Expand
Check 'a small typo still returns the candidates (soulmte)' (@($typo.Items | Where-Object { $_.name -match '(?i)soulmate' }).Count -gt 0) "count $($typo.Items.Count)"

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-SEARCH-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "`nPASS BLK-SEARCH-01 map search"
