param(
    [Parameter(Mandatory = $true)]
    [string]$OsmFile,
    [string]$MongoConnection = "mongodb://localhost:27017",
    [string]$DatabaseName = "BlinkrPlaces"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $OsmFile)) {
    throw "OSM extract not found: $OsmFile"
}

dotnet run --project "$PSScriptRoot\..\src\Tools\Blinkr.Tools.OsmPlaceImporter\Blinkr.Tools.OsmPlaceImporter.csproj" -- "$OsmFile" "$MongoConnection" "$DatabaseName"
