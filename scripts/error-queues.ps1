param(
    [string]$Peek,
    [string]$Replay,
    [string]$Purge,
    [int]$Count = 5,
    [switch]$Confirm,
    [switch]$FailOnMessages,
    [string]$ManagementUrl = "http://localhost:15672"
)

# RabbitMQ error queues (dead letters) - CLAUDE.md §16 "hata queue'sunu gorunur tut", §21 P1 DLQ procedure.
# MassTransit moves a message that failed all retries to "<queue>_error". This tool makes them visible and repairable:
#   (no switch)          list every *_error queue and how many messages it holds
#   -Peek <queue>        show the failure headers of up to -Count messages WITHOUT removing them (requeued)
#   -Replay <queue>      move the messages of <queue>_error back to <queue>; consumers are idempotent (inbox), so a
#                        message that already went through is skipped, and one that failed gets another try
#   -Purge <queue> -Confirm   drop the messages of <queue>_error (after they were understood)
#   -FailOnMessages      exit 1 when any error queue is not empty (for status checks / CI)
# Credentials come from RABBITMQ_DEFAULT_USER / RABBITMQ_DEFAULT_PASS (environment or the root .env); never printed.
# Payloads are not printed (they can hold user text); only ids, types and the failure reason.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Read-EnvValue([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ($value) { return $value }
    $envFile = Join-Path $root ".env"
    if (Test-Path $envFile) {
        $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$Name\s*=" } | Select-Object -First 1
        if ($line) { return ($line -split "=", 2)[1].Trim().Trim('"') }
    }
    return $null
}

$user = Read-EnvValue "RABBITMQ_DEFAULT_USER"
$pass = Read-EnvValue "RABBITMQ_DEFAULT_PASS"
if (-not $user -or -not $pass) { throw "RABBITMQ_DEFAULT_USER / RABBITMQ_DEFAULT_PASS not found (environment or .env)." }
$auth = @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${user}:${pass}")) }

function Api([string]$Method, [string]$Path, $Body) {
    $args = @{ Method = $Method; Uri = "$ManagementUrl/api$Path"; Headers = $auth; UseBasicParsing = $true; TimeoutSec = 20 }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Depth 10 -Compress); $args.ContentType = "application/json" }
    $r = Invoke-WebRequest @args
    if ([string]::IsNullOrWhiteSpace($r.Content)) { return $null }
    return $r.Content | ConvertFrom-Json
}

function ErrorQueue([string]$Name) { if ($Name.EndsWith("_error")) { $Name } else { "${Name}_error" } }
function Source([string]$Name) { if ($Name.EndsWith("_error")) { $Name.Substring(0, $Name.Length - 6) } else { $Name } }

function Get-Messages([string]$Queue, [int]$Take, [string]$AckMode) {
    @(Api POST "/queues/%2F/$([uri]::EscapeDataString($Queue))/get" @{ count = $Take; ackmode = $AckMode; encoding = "auto" })
}

if ($Peek) {
    $queue = ErrorQueue $Peek
    $messages = Get-Messages $queue $Count "ack_requeue_true"
    if ($messages.Count -eq 0) { Write-Host "$queue is empty."; exit 0 }
    foreach ($m in $messages) {
        $h = $m.properties.headers
        Write-Host ("- message {0} | type {1}" -f $m.properties.message_id, (($h.'MT-Fault-MessageType' -join ",") -replace "urn:message:", ""))
        Write-Host ("  failed in {0} at {1}" -f $h.'MT-Fault-ConsumerType', $h.'MT-Fault-Timestamp')
        Write-Host ("  reason: {0}: {1}" -f $h.'MT-Fault-ExceptionType', (($h.'MT-Fault-Message' | Out-String).Trim() -replace "\s+", " ").Substring(0, [Math]::Min(200, (($h.'MT-Fault-Message' | Out-String).Trim()).Length)))
    }
    Write-Host "(peeked $($messages.Count); nothing was removed)"
    exit 0
}

if ($Replay) {
    $queue = ErrorQueue $Replay
    $target = Source $Replay
    $moved = 0
    while ($true) {
        $batch = Get-Messages $queue 50 "ack_requeue_false"
        if ($batch.Count -eq 0) { break }
        foreach ($m in $batch) {
            $props = @{}
            foreach ($p in $m.properties.PSObject.Properties) { if ($p.Name -ne "headers") { $props[$p.Name] = $p.Value } }
            $headers = @{}
            if ($m.properties.headers) { foreach ($p in $m.properties.headers.PSObject.Properties) { if ($p.Name -notlike "MT-Fault-*" -and $p.Name -notlike "MT-Reason") { $headers[$p.Name] = $p.Value } } }
            $props["headers"] = $headers
            $result = Api POST "/exchanges/%2F/amq.default/publish" @{ properties = $props; routing_key = $target; payload = $m.payload; payload_encoding = $m.payload_encoding }
            if (-not $result.routed) { throw "Message $($m.properties.message_id) could not be routed to $target - stopping (it was taken off $queue; look for it in the logs)." }
            $moved++
        }
    }
    Write-Host "Replayed $moved message(s) from $queue to $target."
    exit 0
}

if ($Purge) {
    $queue = ErrorQueue $Purge
    if (-not $Confirm) { Write-Host "Refusing to purge $queue without -Confirm."; exit 1 }
    $null = Api DELETE "/queues/%2F/$([uri]::EscapeDataString($queue))/contents" $null
    Write-Host "Purged $queue."
    exit 0
}

$queues = @(Api GET "/queues/%2F?columns=name,messages" $null) | Where-Object { $_.name -like "*_error" } | Sort-Object name
$waiting = @($queues | Where-Object { $_.messages -gt 0 })
foreach ($q in $waiting) { Write-Output ("{0,-60} {1,6}" -f $q.name, $q.messages) }
$total = ($waiting | Measure-Object -Property messages -Sum).Sum
Write-Output ("Error queues: {0} (with messages: {1}), messages waiting: {2}" -f $queues.Count, $waiting.Count, [int]$total)
if ($FailOnMessages -and $waiting.Count -gt 0) { exit 1 }
