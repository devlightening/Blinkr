param(
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# BLK-BATCH-01: GET /api/places/batch?ids= returns the requested places (with their current state) in one call, so the app can show
# how the places a person saved are doing right now. It is bounded, forgiving about junk, and never invents places.

$ErrorActionPreference = "Stop"
$script:failures = New-Object System.Collections.Generic.List[string]

function Get-Json {
    param([string]$Path)
    $status = 0; $raw = ""
    try { $r = Invoke-WebRequest -UseBasicParsing -Uri "$GatewayBaseUrl$Path" -TimeoutSec 30; $status = [int]$r.StatusCode; $raw = [string]$r.Content }
    catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }
        $status = [int]$response.StatusCode
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream()); $raw = $reader.ReadToEnd(); $reader.Dispose()
    }
    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) { try { $json = $raw | ConvertFrom-Json } catch { } }
    [pscustomobject]@{ Status = $status; Json = $json; Raw = $raw }
}

function Check {
    param([string]$Name, [bool]$Condition, [string]$Detail = "")
    if ($Condition) { Write-Host "PASS $Name" } else { Write-Host "FAIL $Name $Detail" -ForegroundColor Red; $script:failures.Add($Name) }
}

Write-Host "BLK-BATCH-01 place batch via $GatewayBaseUrl"
# Real places from the local catalogue (around the Adana test origin used by the search test).
$near = Get-Json "/api/places/search?q=kafe&lat=37.0306&lon=35.3157&radiusMeters=3000"
$places = @($near.Json | Select-Object -First 3)
Check "the catalogue has places to ask for" ($near.Status -eq 200 -and $places.Count -ge 2) "HTTP $($near.Status) count $($places.Count)"
$ids = @($places | ForEach-Object { $_.id })

$batch = Get-Json "/api/places/batch?ids=$($ids -join ',')"
$got = @($batch.Json)
Check "the requested places come back in one call" ($batch.Status -eq 200 -and $got.Count -eq $ids.Count -and (@($got | Where-Object { $ids -contains $_.id }).Count -eq $ids.Count)) "HTTP $($batch.Status) $($batch.Raw.Substring(0, [Math]::Min(200, $batch.Raw.Length)))"
$first = $got | Select-Object -First 1
Check "each place carries what a saved-place row needs (name, category, coordinates)" ($first.name -and $first.category -and $null -ne $first.latitude -and $null -ne $first.longitude) "$($first | ConvertTo-Json -Compress)"

$mixed = Get-Json "/api/places/batch?ids=$($ids[0]),not-a-guid,$([guid]::NewGuid()),$($ids[0])"
Check "junk ids, unknown places and repeats are ignored (each real place once)" ($mixed.Status -eq 200 -and @($mixed.Json).Count -eq 1 -and $mixed.Json[0].id -eq $ids[0]) "HTTP $($mixed.Status) $($mixed.Raw)"

$empty = Get-Json "/api/places/batch?ids="
$missing = Get-Json "/api/places/batch"
Check "no ids is an empty list, not an error" ($empty.Status -eq 200 -and @($empty.Json).Count -eq 0 -and $missing.Status -eq 200 -and @($missing.Json).Count -eq 0) "HTTP $($empty.Status)/$($missing.Status)"

$many = (1..40 | ForEach-Object { [guid]::NewGuid().ToString() }) -join ","
$capped = Get-Json "/api/places/batch?ids=$many"
Check "40 unknown ids are answered calmly (bounded to 20 lookups)" ($capped.Status -eq 200 -and @($capped.Json).Count -eq 0) "HTTP $($capped.Status)"

if ($script:failures.Count -gt 0) {
    Write-Host "`nFAIL BLK-BATCH-01: $($script:failures.Count) check(s) failed" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "`nPASS BLK-BATCH-01 place batch"
