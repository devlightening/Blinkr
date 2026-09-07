param(
    [Parameter(Mandatory = $true)]
    [double]$Latitude,
    [Parameter(Mandatory = $true)]
    [double]$Longitude,
    [int]$RadiusMeters = 2000,
    [string]$Name,
    [string]$DatabaseName = "BlinkrPlaces"
)

$ErrorActionPreference = "Stop"
$safeName = if ([string]::IsNullOrWhiteSpace($Name)) { "" } else { $Name.Replace("\", "\\").Replace("'", "\'") }

$script = @"
const origin = { lat: $Latitude, lon: $Longitude };
const radius = $RadiusMeters;
const name = '$safeName';
function radians(value) { return value * Math.PI / 180; }
function distanceMeters(a, b) {
  const earth = 6371000;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
const query = { IsActive: true };
if (name) query.Name = { `$regex: name, `$options: 'i' };
const rows = db.places.find(query).projection({
  _id: 1,
  Name: 1,
  Category: 1,
  ExternalProvider: 1,
  ExternalId: 1,
  Latitude: 1,
  Longitude: 1
}).toArray()
  .map(p => ({
    PlaceId: p._id,
    Name: p.Name,
    Category: p.Category,
    DistanceMeters: Math.round(distanceMeters(origin, { lat: p.Latitude, lon: p.Longitude })),
    ExternalProvider: p.ExternalProvider,
    ExternalId: p.ExternalId,
    Latitude: p.Latitude,
    Longitude: p.Longitude
  }))
  .filter(p => p.DistanceMeters <= radius)
  .sort((a, b) => a.DistanceMeters - b.DistanceMeters);
printjson(rows);
"@

docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval "$script"
