param(
    [string]$PbfPath,
    [string]$DownloadUrl,
    [string]$DownloadDirectory = "C:\osm",
    [string]$MongoConnection = "mongodb://localhost:27017",
    [string]$DatabaseName = "BlinkrPlaces"
)

$ErrorActionPreference = "Stop"

function Resolve-PbfPath {
    if (-not [string]::IsNullOrWhiteSpace($PbfPath)) {
        if (-not (Test-Path -LiteralPath $PbfPath)) {
            throw "REAL_PBF_REQUIRED: OSM PBF file was not found: $PbfPath"
        }
        return (Resolve-Path -LiteralPath $PbfPath).Path
    }

    if ([string]::IsNullOrWhiteSpace($DownloadUrl)) {
        throw "REAL_PBF_REQUIRED: pass -PbfPath C:\osm\region.osm.pbf, or pass a verified -DownloadUrl for a regional .osm.pbf extract."
    }

    if ($DownloadUrl -notmatch '^https?://.+\.osm\.pbf($|\?)') {
        throw "DownloadUrl must point to a regional .osm.pbf extract."
    }

    New-Item -ItemType Directory -Force -Path $DownloadDirectory | Out-Null
    $fileName = [System.IO.Path]::GetFileName(([Uri]$DownloadUrl).AbsolutePath)
    $target = Join-Path $DownloadDirectory $fileName
    Write-Host "OSM source: $DownloadUrl"
    Write-Host "OSM file:   $target"

    if (Test-Path -LiteralPath $target) {
        Write-Host "Reusing existing downloaded PBF."
        return (Resolve-Path -LiteralPath $target).Path
    }

    Invoke-WebRequest -UseBasicParsing -Uri $DownloadUrl -OutFile $target
    return (Resolve-Path -LiteralPath $target).Path
}

function Normalize-LegacyCategories {
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "normalize-place-catalog.ps1") -DatabaseName $DatabaseName
}

$resolvedPbf = Resolve-PbfPath
Write-Host "Importing OSM places from: $resolvedPbf"
powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "import-osm-places.ps1") $resolvedPbf $MongoConnection $DatabaseName
Normalize-LegacyCategories

$summaryScript = @'
const total = db.places.countDocuments({});
const osm = db.places.countDocuments({ExternalProvider:"osm"});
const categories = db.places.aggregate([{$group:{_id:"$Category",count:{$sum:1}}},{$sort:{count:-1}}]).toArray();
printjson({TotalPlaces: total, OsmPlaces: osm, Categories: categories});
'@
docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval $summaryScript
