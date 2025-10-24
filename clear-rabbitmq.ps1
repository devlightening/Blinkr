# Clear RabbitMQ queues
Write-Host "Purging RabbitMQ queues..." -ForegroundColor Yellow

$queues = @("post-created", "post-content-updated", "post-deleted", "post-liked", "post-comment-added")

foreach ($queue in $queues) {
    Write-Host "Purging queue: $queue" -ForegroundColor Cyan
    curl.exe -u user:password -X DELETE "http://localhost:15672/api/queues/%2F/$queue/contents"
}

Write-Host "Done!" -ForegroundColor Green
