param(
    [string]$DatabaseName = "BlinkrPlaces"
)

$ErrorActionPreference = "Stop"

function Invoke-Update {
    param([string]$Name, [string]$Expression)
    $count = docker exec blinkr_mongodb mongosh $DatabaseName --quiet --eval $Expression
    [pscustomobject]@{ Name = $Name; Modified = [int]$count }
}

$results = @(
    Invoke-Update "legacy-cafe" "db.places.updateMany({Category:{`$in:['Cafe','cafe']}},{`$set:{Category:'CAFE',UpdatedAtUtc:new Date()}}).modifiedCount"
    Invoke-Update "legacy-school" "db.places.updateMany({Category:{`$in:['school','School']}},{`$set:{Category:'EDUCATION',UpdatedAtUtc:new Date()}}).modifiedCount"
    Invoke-Update "mosque-name" "db.places.updateMany({Name:{`$regex:'(cami|camii|mescit)',`$options:'i'}},{`$set:{Category:'MOSQUE',UpdatedAtUtc:new Date()}}).modifiedCount"
    Invoke-Update "park-name" "db.places.updateMany({Name:{`$regex:'(park|parkı|parki)',`$options:'i'}},{`$set:{Category:'PARK',UpdatedAtUtc:new Date()}}).modifiedCount"
    Invoke-Update "pharmacy-name" "db.places.updateMany({Name:{`$regex:'(eczane|eczanesi)',`$options:'i'}},{`$set:{Category:'PHARMACY',UpdatedAtUtc:new Date()}}).modifiedCount"
)

$results | Format-Table -AutoSize
$total = ($results | Measure-Object -Property Modified -Sum).Sum
Write-Host "TotalModified=$total"
