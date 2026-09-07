# Blinkr Scripts

## Local Development Stack

Start the backend stack from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-blinkr-dev.ps1
```

Check status:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\status-blinkr-dev.ps1
```

Stop application processes started by the dev script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-blinkr-dev.ps1
```

Stop application processes and Docker infrastructure:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-blinkr-dev.ps1 -Infrastructure
```

Expo physical device testing:

```cmd
cd src\Clients\Blinkr.Expo
set EXPO_PUBLIC_BLINKR_API_URL=http://<LAN-IP>:5080
npx expo start --lan
```

The canonical backend startup path is `start-blinkr-dev.ps1`. Older mobile-backend scripts delegate to it.

## Local OSM Place Import

Blinkr beta uses a deterministic local POI catalog for the nearby place picker. Public Overpass availability is not required for the normal mobile composer path.

1. Download a regional OpenStreetMap extract, for example Turkey or Ankara, as `.osm.pbf` from a trusted OSM extract provider such as Geofabrik.
2. Keep the extract outside git, for example `C:\osm\turkey-latest.osm.pbf`.
3. Start MongoDB.
4. Import places:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-place-catalog.ps1 -PbfPath C:\osm\turkey-latest.osm.pbf
```

You can also pass a verified regional extract URL:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-place-catalog.ps1 -DownloadUrl https://download.geofabrik.de/europe/turkey-latest.osm.pbf
```

5. Confirm nearby places through Gateway after services are running:

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:5080/api/places/nearby?lat=39.9334&lon=32.8597&radiusMeters=900&limit=20"
```

Or print a compact local catalog table:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-local-place-catalog.ps1 -Latitude 39.9334 -Longitude 32.8597 -RadiusMeters 1000
```

The importer is idempotent. Re-importing the same extract updates existing `ExternalProvider=osm` / `ExternalId=node|way|relation/id` records instead of duplicating places.
