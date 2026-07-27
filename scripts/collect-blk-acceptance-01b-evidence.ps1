param(
    [Parameter(Mandatory = $true)]
    [string]$PostId,

    [string]$GatewayBaseUrl = "http://localhost:5080",
    [double]$MinLat = 40.9,
    [double]$MinLng = 28.8,
    [double]$MaxLat = 41.2,
    [double]$MaxLng = 29.2,
    [int]$SinceMinutes = 10080,
    [string]$OutputDir = "artifacts\blk-acceptance-01b"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportPath = Join-Path $OutputDir "evidence-$PostId-$timestamp.md"
$jsonPath = Join-Path $OutputDir "gateway-bounds-$PostId-$timestamp.json"

function Add-Section {
    param([string]$Title, [string]$Body)
    Add-Content -Path $reportPath -Value ""
    Add-Content -Path $reportPath -Value "## $Title"
    Add-Content -Path $reportPath -Value ""
    Add-Content -Path $reportPath -Value '```text'
    Add-Content -Path $reportPath -Value $Body
    Add-Content -Path $reportPath -Value '```'
}

"# BLK-ACCEPTANCE-01B Evidence" | Set-Content -Path $reportPath
Add-Content -Path $reportPath -Value ""
Add-Content -Path $reportPath -Value "- PostId: $PostId"
Add-Content -Path $reportPath -Value "- CollectedAt: $(Get-Date -Format o)"
Add-Content -Path $reportPath -Value "- Gateway: $GatewayBaseUrl"

$boundsUrl = "$GatewayBaseUrl/api/posts-read/bounds?minLat=$MinLat&minLng=$MinLng&maxLat=$MaxLat&maxLng=$MaxLng&sinceMinutes=$SinceMinutes&pageSize=200"
$bounds = Invoke-RestMethod -Uri $boundsUrl -Method Get
$bounds | ConvertTo-Json -Depth 20 | Set-Content -Path $jsonPath
$boundsText = $bounds | ConvertTo-Json -Depth 20
Add-Section "Gateway Bounds Response" $boundsText

$matchingItem = @($bounds.items) | Where-Object { $_.id -eq $PostId } | Select-Object -First 1
if ($null -eq $matchingItem) {
    Add-Content -Path $reportPath -Value ""
    Add-Content -Path $reportPath -Value "> RESULT: FAIL - PostId was not found in Gateway bounds response."
} else {
    Add-Content -Path $reportPath -Value ""
    Add-Content -Path $reportPath -Value "> RESULT: PASS - PostId was found in Gateway bounds response."
}

$streamUrl = "http://localhost:2113/streams/PostAggregate-$PostId/head/backward/1?embed=body"
try {
    $eventStore = Invoke-WebRequest -UseBasicParsing -Uri $streamUrl -Headers @{ Accept = "application/vnd.eventstore.atom+json" } -TimeoutSec 10
    $eventStoreContent = if ($eventStore.Content -is [byte[]]) {
        [System.Text.Encoding]::UTF8.GetString($eventStore.Content)
    } else {
        [string]$eventStore.Content
    }
    Add-Section "EventStore Stream Head" $eventStoreContent
} catch {
    Add-Section "EventStore Stream Head" "Could not read $streamUrl`n$($_.Exception.Message)"
}

$queues = docker exec blinkr_rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers
Add-Section "RabbitMQ Queues" ($queues -join "`n")

$workerLogs = docker logs blinkr_projections_worker --tail 300 2>&1 | Select-String -Pattern $PostId -Context 3,3
Add-Section "Worker Consume Log" (($workerLogs | ForEach-Object { $_.ToString() }) -join "`n")

$mongoQuery = "db.getSiblingDB('BlinkrReadModel').posts.find({_id:'$PostId'}).toArray()"
$mongo = docker exec blinkr_mongodb mongosh --quiet --eval $mongoQuery
Add-Section "Mongo Projection" ($mongo -join "`n")

$sql = "select ""Id"", ""Title"", ""Latitude"", ""Longitude"", ""AccuracyMeters"", ""LocationName"" from ""Posts"" where ""Id"" = '$PostId';"
$postgres = $sql | docker exec -i blinkr_postgres psql -U silvanus -d blinkr_blog -t -A
Add-Section "Postgres Write Model" ($postgres -join "`n")

Write-Host "Evidence report: $reportPath"
Write-Host "Gateway bounds JSON: $jsonPath"
