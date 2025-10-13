# Read first message from error queue

$apiUrl = "http://localhost:15672/api/queues/%2F/blinkr-post-created_error/get"
$auth = "user:password"
$authBytes = [System.Text.Encoding]::UTF8.GetBytes($auth)
$authBase64 = [Convert]::ToBase64String($authBytes)

$headers = @{
    "Authorization" = "Basic $authBase64"
    "Content-Type" = "application/json"
}

$body = @{
    count = 1
    ackmode = "ack_requeue_false"
    encoding = "auto"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $body
    
    if ($response.Count -gt 0) {
        $msg = $response[0]
        Write-Host "=== ERROR MESSAGE ===" -ForegroundColor Red
        Write-Host "Exchange: $($msg.exchange)" -ForegroundColor Cyan
        Write-Host "Routing Key: $($msg.routing_key)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Payload:" -ForegroundColor Yellow
        Write-Host $msg.payload -ForegroundColor White
        Write-Host ""
        Write-Host "Properties:" -ForegroundColor Yellow
        $msg.properties | ConvertTo-Json -Depth 5
    } else {
        Write-Host "No messages in error queue" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error reading queue: $($_.Exception.Message)" -ForegroundColor Red
}
