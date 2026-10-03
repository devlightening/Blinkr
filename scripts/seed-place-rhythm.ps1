param(
    [Parameter(Mandatory = $true)][string]$PlaceId,
    [int]$Weeks = 8,
    [string]$MongoConnectionString = "mongodb://localhost:27017",
    [switch]$Remove
)

# DEV ONLY (D-037): fills one place's "Yerin Ritmi" with backdated, synthetic VERIFIED_LIVE Crowd signals so the chart
# can be looked at. Signals created through the API always carry "now", so history can only be written to PlaceService's
# own read collection (place_signals). Nothing goes to EventStore, BlogService or the map: every row is expired, carries
# Title "seed-rhythm" and a synthetic author id, and `-Remove` deletes exactly those rows.
# Shape: weekdays quiet mornings, busy lunch (12-13) and evenings (18-20); weekends busy afternoons. 3-5 people per hour,
# so every seeded hour passes the 3-person rule.
# ASCII only on purpose: Windows PowerShell 5 reads a BOM-less script as ANSI.

$ErrorActionPreference = "Stop"
if (-not ($PlaceId -match '^[0-9a-fA-F-]{36}$')) { throw "PlaceId must be a GUID." }

function Invoke-Mongo {
    param([string]$Script)
    if (Get-Command mongosh -ErrorAction SilentlyContinue) {
        & mongosh "$MongoConnectionString/BlinkrPlaces" --quiet --eval $Script
        return
    }
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        & docker exec blinkr_mongodb mongosh "mongodb://localhost:27017/BlinkrPlaces" --quiet --eval $Script
        return
    }
    throw "mongosh was not found locally and docker is unavailable."
}

if ($Remove) {
    Invoke-Mongo "const r = db.place_signals.deleteMany({ PlaceId: '$PlaceId', Title: 'seed-rhythm' }); print('removed ' + r.deletedCount);"
    exit 0
}

$js = @"
const placeId = '$PlaceId';
const weeks = $Weeks;
// Turkey is UTC+3 all year: local hour h is UTC hour h-3.
const level = (weekday, hour) => {
  const weekend = weekday === 0 || weekday === 6;
  if (weekend) return hour >= 13 && hour <= 18 ? 'Busy' : hour >= 10 && hour <= 21 ? 'Moderate' : 'Calm';
  if (hour === 12 || hour === 13 || (hour >= 18 && hour <= 20)) return 'Busy';
  if (hour >= 9 && hour <= 21) return 'Moderate';
  return 'Calm';
};
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
const people = Array.from({ length: 12 }, uuid);
const docs = [];
const now = Date.now();
for (let day = 1; day <= weeks * 7; day++) {
  for (let hour = 7; hour <= 22; hour++) {
    const local = new Date(now - day * 86400000);
    const at = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour - 3, 15 + Math.floor(Math.random() * 30));
    const weekday = new Date(at + 3 * 3600000).getUTCDay();
    if (Math.random() < 0.35) continue;
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      docs.push({ _id: uuid(), PlaceId: placeId, Title: 'seed-rhythm', Text: null, SignalType: 'Crowd', SignalValue: level(weekday, hour),
        PublicationTrust: 'VERIFIED_LIVE', AuthorName: null, AuthorId: people[(day + hour + i) % people.length],
        CreatedAtUtc: new Date(at + i * 60000), ExpiresAtUtc: new Date(at + i * 60000 + 3600000), LocationName: null, Media: [] });
    }
  }
}
db.place_signals.insertMany(docs);
print('seeded ' + docs.length + ' synthetic signals for ' + placeId);
"@

Invoke-Mongo $js
Write-Host "Open the place in the app: the 'Yerin ritmi' card should now show a weekly rhythm. Remove with -Remove."
