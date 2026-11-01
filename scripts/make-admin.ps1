param(
    [Parameter(Mandatory = $true)][string]$User,
    [switch]$Revoke,
    [string]$Container = "blinkr_postgres",
    [string]$Database = "blinkr_identity"
)

# Gives (or with -Revoke takes back) the Admin role, which the moderation endpoints require (sinyal-mvp-plan Faz 10
# P10.4). -User is a user name or e-mail. Runs psql inside the local Postgres container with the container's own
# user, so no password is typed or stored here. The person must sign in again for a token with the new role.

$ErrorActionPreference = "Stop"
if ($User -notmatch '^[A-Za-z0-9_.@+\-]{1,120}$') { throw "User must be a user name or e-mail address." }
$role = if ($Revoke) { "User" } else { "Admin" }
$key = $User.ToLowerInvariant()
$sql = "UPDATE ""Users"" SET ""Role"" = '$role' WHERE lower(""UserName"") = '$key' OR lower(""Email"") = '$key';"
$out = $sql | & docker exec -i $Container sh -c 'psql -U "$POSTGRES_USER" -d "$0" -v ON_ERROR_STOP=1 -t' $Database 2>&1
if ($LASTEXITCODE -ne 0) { throw "psql failed: $out" }
$count = if ("$out" -match 'UPDATE (\d+)') { [int]$Matches[1] } else { -1 }
if ($count -eq 0) { Write-Host "No user named '$User'." -ForegroundColor Yellow; exit 1 }
Write-Host "$User -> $role. Sign in again to get a token with the new role."
