param(
    [string]$MongoConnection = "mongodb://localhost:27017",
    [string]$DatabaseName = "BlinkrPlacesImporterTest"
)

$ErrorActionPreference = "Stop"
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) "blinkr-osm-import-fixture.osm"

@'
<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="blinkr-test">
  <node id="1001" lat="39.933760" lon="32.859700">
    <tag k="name" v="Fixture Cafe"/>
    <tag k="amenity" v="cafe"/>
  </node>
  <node id="1002" lat="39.933800" lon="32.859710">
    <tag k="name" v="Fixture Bakery"/>
    <tag k="shop" v="bakery"/>
  </node>
  <node id="1003" lat="39.933820" lon="32.859720">
    <tag k="name" v="Fixture Pharmacy"/>
    <tag k="amenity" v="pharmacy"/>
  </node>
  <node id="1004" lat="39.933830" lon="32.859730">
    <tag k="name" v="Fixture Camii"/>
    <tag k="amenity" v="place_of_worship"/>
    <tag k="religion" v="muslim"/>
  </node>
  <node id="2001" lat="39.934000" lon="32.860000"/>
  <node id="2002" lat="39.934100" lon="32.860000"/>
  <node id="2003" lat="39.934100" lon="32.860100"/>
  <node id="2004" lat="39.934000" lon="32.860100"/>
  <way id="3001">
    <nd ref="2001"/>
    <nd ref="2002"/>
    <nd ref="2003"/>
    <nd ref="2004"/>
    <nd ref="2001"/>
    <tag k="name" v="Fixture Market"/>
    <tag k="shop" v="supermarket"/>
  </way>
  <relation id="4001">
    <member type="way" ref="3001" role="outer"/>
    <tag k="name" v="Fixture Park"/>
    <tag k="leisure" v="park"/>
  </relation>
</osm>
'@ | Set-Content -LiteralPath $fixture -Encoding UTF8

docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval "db.dropDatabase()" | Out-Null

powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\import-osm-places.ps1" $fixture $MongoConnection $DatabaseName | Out-Host
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\import-osm-places.ps1" $fixture $MongoConnection $DatabaseName | Out-Host

$count = docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval "db.places.countDocuments({ExternalProvider:'osm'})"
$unique = docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval "db.places.distinct('ExternalId', {ExternalProvider:'osm'}).length"
$near = docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval "db.places.find({ExternalProvider:'osm'}).projection({Name:1, ExternalId:1, Category:1, _id:0}).toArray().length"
$bakery = docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval "db.places.countDocuments({Name:'Fixture Bakery', Category:'BAKERY'})"
$pharmacy = docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval "db.places.countDocuments({Name:'Fixture Pharmacy', Category:'PHARMACY'})"
$mosque = docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval "db.places.countDocuments({Name:'Fixture Camii', Category:'MOSQUE'})"
$park = docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval "db.places.countDocuments({Name:'Fixture Park', Category:'PARK'})"

if ([int]$count -ne 6) { throw "Expected 6 imported places, got $count" }
if ([int]$unique -ne 6) { throw "Expected 6 unique OSM identities, got $unique" }
if ([int]$near -ne 6) { throw "Expected node, way, and relation POIs, got $near" }
if ([int]$bakery -ne 1) { throw "Expected bakery category normalization." }
if ([int]$pharmacy -ne 1) { throw "Expected pharmacy category normalization." }
if ([int]$mosque -ne 1) { throw "Expected mosque category normalization." }
if ([int]$park -ne 1) { throw "Expected park category normalization." }

Write-Host "PASS BLK-LOCATION-04 OSM importer integration"
