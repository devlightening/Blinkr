# Test: Create a new post
$uri = "https://localhost:7259/api/Posts"
$body = @{
    title = "Test Post - $(Get-Date -Format 'HH:mm:ss')"
    content = "Bu bir test post'udur. EventStore -> RabbitMQ -> Worker -> MongoDB akışını test ediyoruz."
    authorId = "00000000-0000-0000-0000-000000000001"
} | ConvertTo-Json

Write-Host "🚀 Creating new post..." -ForegroundColor Cyan
Write-Host "URL: $uri" -ForegroundColor Gray
Write-Host "Body: $body" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType "application/json" -SkipCertificateCheck
    Write-Host "✅ Post created successfully!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Check EventStore UI: http://localhost:2113" -ForegroundColor Gray
    Write-Host "2. Check RabbitMQ UI: http://localhost:15672 (user/password)" -ForegroundColor Gray
    Write-Host "3. Check MongoDB: http://localhost:8081 (admin/password)" -ForegroundColor Gray
    Write-Host "4. Check Worker logs for consumption" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Error creating post:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}
