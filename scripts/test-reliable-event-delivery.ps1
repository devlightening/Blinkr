param(
    [string]$GatewayBaseUrl = "http://localhost:5080",
    [int]$ProjectionTimeoutSeconds = 90,
    [int]$PublishRetryGraceSeconds = 10,
    [string]$RabbitContainer = "blinkr_rabbitmq",
    [string]$MongoContainer = "blinkr_mongodb"
)

$ErrorActionPreference = "Stop"

function Wait-Http {
    param([string]$Url, [int]$TimeoutSeconds = 60)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }

    throw "Timed out waiting for $Url"
}

function Wait-ContainerRunning {
    param([string]$Container, [int]$TimeoutSeconds = 60)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $state = docker inspect --format "{{.State.Status}}" $Container 2>$null
        if ($state -eq "running") {
            return
        }

        Start-Sleep -Seconds 2
    }

    throw "$Container did not become running in $TimeoutSeconds seconds."
}

function New-TestUserToken {
    $stamp = Get-Date -Format "yyyyMMddHHmmssfff"
    $userName = "reliable_$stamp"
    $registration = @{
        userName = $userName
        email = "$userName@blinkr.local"
        password = "BlinkrTest!123"
    } | ConvertTo-Json

    $auth = Invoke-RestMethod `
        -Uri "$GatewayBaseUrl/api/auth/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $registration

    return $auth.token
}

function New-TestSignal {
    param([string]$Token)

    $expiresAt = (Get-Date).ToUniversalTime().AddHours(1).ToString("o")
    $body = @{
        title = "Reliable delivery smoke"
        content = "RabbitMQ outage recovery test"
        media = @()
        latitude = 39.9278652939
        longitude = 32.6417046296
        accuracyMeters = 25
        locationName = "Ankara reliable delivery area"
        signalType = "GeneralObservation"
        signalValue = "Open"
        audienceType = "Public"
        identityDisclosure = "AnonymousMap"
        locationPrecision = "ApproximateArea"
        expiresAt = $expiresAt
    } | ConvertTo-Json

    $created = Invoke-RestMethod `
        -Uri "$GatewayBaseUrl/api/posts" `
        -Method Post `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $Token" } `
        -Body $body

    return $created.postId
}

function Assert-EventStoreContainsPost {
    param([string]$PostId)

    $streamUrl = "http://localhost:2113/streams/PostAggregate-$PostId"
    $eventStore = Invoke-RestMethod -Uri $streamUrl -Headers @{ Accept = "application/vnd.eventstore.atom+json" } -TimeoutSec 10
    if (-not $eventStore.entries -or $eventStore.entries.Count -lt 1) {
        throw "EventStore stream is empty for PostId=$PostId"
    }
}

function Wait-ForProjection {
    param([string]$PostId)

    $deadline = (Get-Date).AddSeconds($ProjectionTimeoutSeconds)
    do {
        Start-Sleep -Seconds 2
        $url = "$GatewayBaseUrl/api/posts-read/bounds?minLat=39.8&minLng=32.5&maxLat=40.1&maxLng=32.8&sinceMinutes=180&pageSize=200"
        $response = Invoke-RestMethod -Uri $url -Method Get
        $match = @($response.items) | Where-Object { $_.id -eq $PostId } | Select-Object -First 1
        if ($match) {
            return $match
        }
    } while ((Get-Date) -lt $deadline)

    return $null
}

function Get-MongoValue {
    param([string]$Script)
    return (docker exec $MongoContainer mongosh --quiet --eval $Script | Select-Object -Last 1).Trim()
}

Write-Host "BLK-INFRA-01 reliable delivery smoke" -ForegroundColor Cyan
Wait-Http "$GatewayBaseUrl/health" 30

$rabbitWasRunning = (docker inspect --format "{{.State.Status}}" $RabbitContainer 2>$null) -eq "running"
$postId = $null

try {
    $token = New-TestUserToken

    Write-Host "[1/6] Stopping RabbitMQ to simulate transient broker outage..." -ForegroundColor Yellow
    docker stop $RabbitContainer | Out-Null
    Start-Sleep -Seconds 5

    Write-Host "[2/6] Creating post while RabbitMQ is unavailable..." -ForegroundColor Yellow
    $postId = New-TestSignal -Token $token
    Write-Host "      PostId: $postId"

    Write-Host "[3/6] Verifying authoritative EventStore persistence..." -ForegroundColor Yellow
    Assert-EventStoreContainsPost -PostId $postId

    Write-Host "[4/6] Restarting RabbitMQ..." -ForegroundColor Yellow
    docker start $RabbitContainer | Out-Null
    Wait-ContainerRunning $RabbitContainer 60
    Start-Sleep -Seconds $PublishRetryGraceSeconds

    Write-Host "[5/6] Waiting for projection to appear in Gateway bounds..." -ForegroundColor Yellow
    $projection = Wait-ForProjection -PostId $postId
    if (-not $projection) {
        throw "Projection did not appear in Gateway bounds for PostId=$postId"
    }

    Write-Host "[6/6] Verifying Mongo projection and publisher status..." -ForegroundColor Yellow
    $mongoCount = Get-MongoValue "db=db.getSiblingDB('BlinkrReadModel'); db.posts.countDocuments({_id:'$postId'})"
    if ($mongoCount -ne "1") {
        throw "Expected exactly one Mongo projection for PostId=$postId, actual=$mongoCount"
    }

    $processedCount = Get-MongoValue "db=db.getSiblingDB('BlinkrReadModel'); db.processed_messages.countDocuments({eventId:{`$exists:true}, consumer:'PostCreatedConsumer'})"
    $publisherState = Get-MongoValue "db=db.getSiblingDB('BlinkrReadModel'); var s=db.publisher_status.findOne({_id:'publisher-posts'}); print(s ? s.state : 'missing')"

    Write-Host "PASS: RabbitMQ outage recovered without manual replay" -ForegroundColor Green
    Write-Host "PostId: $postId"
    Write-Host "MongoProjectionCount: $mongoCount"
    Write-Host "PostCreatedInboxRows: $processedCount"
    Write-Host "PublisherState: $publisherState"
} finally {
    if ($rabbitWasRunning) {
        $state = docker inspect --format "{{.State.Status}}" $RabbitContainer 2>$null
        if ($state -ne "running") {
            Write-Host "Restoring RabbitMQ container..." -ForegroundColor Yellow
            docker start $RabbitContainer | Out-Null
        }
    }
}
