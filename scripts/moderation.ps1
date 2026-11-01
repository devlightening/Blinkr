param(
    [ValidateSet("queue", "resolve", "actions")][string]$Command = "queue",
    [string]$Email,
    [string]$Password,
    [ValidateSet("signal", "user")][string]$TargetType,
    [string]$TargetId,
    [string]$Action,
    [string]$Note,
    [string]$GatewayBaseUrl = "http://localhost:5080"
)

# Minimal moderation console (sinyal-mvp-plan Faz 10 P10.4, 11 §4 "en azından CLI script"). Needs an account with the
# Admin role (scripts/make-admin.ps1). Examples:
#   .\scripts\moderation.ps1 queue -Email mod@example.com
#   .\scripts\moderation.ps1 resolve -Email mod@example.com -TargetType signal -TargetId <postId> -Action restore
#   .\scripts\moderation.ps1 resolve -Email mod@example.com -TargetType user -TargetId <userId> -Action restrict_24h -Note "spam"
#   .\scripts\moderation.ps1 actions -Email mod@example.com
# Signal actions: dismiss | hide | restore | remove. User actions: dismiss | warn | restrict_24h | suspend_7d | ban.
# The password is asked for when not given, and is never written anywhere.

$ErrorActionPreference = "Stop"
if (-not $Email) { $Email = Read-Host "Moderator e-mail" }
if (-not $Password) {
    $secure = Read-Host "Password" -AsSecureString
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

$login = Invoke-RestMethod -Method POST -Uri "$GatewayBaseUrl/api/auth/login" -ContentType "application/json" -Body (@{ userName = $Email; password = $Password } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.token)" }

switch ($Command) {
    "queue" {
        $queue = Invoke-RestMethod -Uri "$GatewayBaseUrl/api/admin/reports" -Headers $headers
        Write-Host "Open reports: $($queue.openReports)"
        $queue.items | ForEach-Object {
            $reasons = ($_.reasons.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ", "
            [pscustomobject]@{
                Priority = if ($_.priority) { "!" } else { "" }
                Type = $_.targetType; Target = $_.targetId; Reports = $_.reports; Score = $_.score
                State = $_.signalState; Reasons = $reasons; Last = $_.lastReportedAtUtc
            }
        } | Format-Table -AutoSize
    }
    "resolve" {
        if (-not $TargetType -or -not $TargetId -or -not $Action) { throw "resolve needs -TargetType, -TargetId and -Action." }
        $body = @{ targetType = $TargetType; targetId = $TargetId; action = $Action; note = $Note } | ConvertTo-Json
        $result = Invoke-RestMethod -Method POST -Uri "$GatewayBaseUrl/api/admin/reports/resolve" -Headers $headers -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
        Write-Host "Done: $($result.action) on $TargetType $TargetId"
    }
    "actions" {
        $query = if ($TargetId) { "?targetId=$TargetId" } else { "" }
        (Invoke-RestMethod -Uri "$GatewayBaseUrl/api/admin/actions$query" -Headers $headers).items |
            Select-Object createdAtUtc, targetType, targetId, action, automatic, note | Format-Table -AutoSize
    }
}
