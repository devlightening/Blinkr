using BlogService.Application.Services;
using Microsoft.Extensions.Options;
using PlaceService.Api.Application;
using PlaceService.Api.Domain;
using MongoDB.Driver;
using MongoDB.Bson;
using NetTopologySuite.IO;
using System.Net.Http.Json;

var policy = new PlaceProximityPolicy(Options.Create(new PlaceProximityOptions()));
void Check(bool value, string name) { if (!value) throw new Exception(name); Console.WriteLine($"PASS {name}"); }
PlaceProximityDecision At(double metres, double accuracy = 0, string? geometry = null) =>
    policy.Evaluate(new("Crowd", 0, 0, metres / 6371000 * 180 / Math.PI, 0, accuracy, geometry));
Check(At(100).TrustLevel == "VERIFIED_LIVE", "100m verified");
Check(At(350).IsAllowed && At(350).TrustLevel == "NEARBY_PLACE_POST", "350m nearby permitted");
Check(!At(900).IsAllowed, "900m browse only");
Check(At(230, 35).TrustLevel == "VERIFIED_LIVE", "35m accuracy tolerance");
Check(!At(100, 2000).IsAllowed, "2000m accuracy rejected");
Check(At(280, 150).TrustLevel == "NEARBY_PLACE_POST", "accuracy allowance capped at 50m");
Check(At(500, 0, "POLYGON ((-0.01 -0.01, 0.01 -0.01, 0.01 0.01, -0.01 0.01, -0.01 -0.01))").TrustLevel == "VERIFIED_LIVE", "inside polygon, distant centroid");
Check(At(500, 0, "broken").TrustLevel == "NEARBY_PLACE_POST", "malformed geometry point fallback");
Check(At(500, 0, "POLYGON ((-0.02 -0.02, 0.02 -0.02, 0.02 0.02, -0.02 0.02, -0.02 -0.02), (-0.01 -0.01, -0.01 0.01, 0.01 0.01, 0.01 -0.01, -0.01 -0.01))").TrustLevel != "VERIFIED_LIVE", "polygon hole is not presence");
var now = DateTime.UtcNow;
PlaceSignalDocument Signal(string? trust, string value) => new() { PostId = Guid.NewGuid(), PlaceId = Guid.NewGuid(), PublicationTrust = trust, SignalType = "Crowd", SignalValue = value, CreatedAtUtc = now, ExpiresAtUtc = now.AddHours(3) };
var calculator = new CurrentPlaceStateCalculator();
Check(calculator.Calculate([Signal("NEARBY_PLACE_POST", "Busy")], now).ActiveSignalCount == 0, "nearby excluded from live state");
Check(calculator.Calculate([Signal(null, "Busy")], now).ActiveSignalCount == 0, "legacy unproven events fail closed");
var state = calculator.Calculate([Signal("VERIFIED_LIVE", "Calm"), Signal("NEARBY_PLACE_POST", "Busy")], now);
Check(state.ActiveSignalCount == 1 && state.SignalValue == "Calm", "verified state unaffected by nearby content");

// One voice per person and signal type: repeating or re-confirming a value must not inflate the state.
PlaceSignalDocument By(Guid? author, string value, int minutesAgo = 0, string type = "Crowd") =>
    new() { PostId = Guid.NewGuid(), PlaceId = Guid.NewGuid(), AuthorId = author, PublicationTrust = "VERIFIED_LIVE", SignalType = type, SignalValue = value, CreatedAtUtc = now.AddMinutes(-minutesAgo), ExpiresAtUtc = now.AddHours(3) };
var alice = Guid.NewGuid(); var bob = Guid.NewGuid();
var spam = calculator.Calculate([By(alice, "Busy", 1), By(alice, "Busy", 2), By(alice, "Busy", 3)], now);
Check(spam.ActiveSignalCount == 1, "one person repeating a value counts once");
var single = calculator.Calculate([By(alice, "Busy", 1)], now);
Check(spam.ConfidenceValue == single.ConfidenceValue, "repeating a value does not raise confidence");
var changed = calculator.Calculate([By(alice, "Busy", 20), By(alice, "Calm", 1)], now);
Check(changed.SignalValue == "Calm" && changed.ActiveSignalCount == 1, "a person's newest value replaces their older one");
var two = calculator.Calculate([By(alice, "Busy", 2), By(bob, "Busy", 1)], now);
Check(two.ActiveSignalCount == 2 && two.ConfidenceValue > single.ConfidenceValue, "two people agreeing raise confidence");
var dims = calculator.Calculate([By(alice, "Busy", 2), By(alice, "Over15", 1, "Queue")], now);
Check(dims.ActiveSignalCount == 2, "different signal types from one person both count");
var legacy = calculator.Calculate([By(null, "Busy", 2), By(null, "Busy", 1)], now);
Check(legacy.ActiveSignalCount == 2, "signals without a known author each stay their own voice");
var outvoted = calculator.Calculate([By(alice, "Busy", 40), By(alice, "Busy", 30), By(bob, "Calm", 5), By(Guid.NewGuid(), "Calm", 4)], now);
Check(outvoted.SignalValue == "Calm", "two people beat one person repeating themselves");

// P5.11: an old gallery photo can only lower trust, never raise it.
var t0 = new DateTime(2026, 9, 23, 12, 0, 0, DateTimeKind.Utc);
Check(GalleryMediaPolicy.CapTrust("VERIFIED_LIVE", true, t0.AddHours(-3), t0) == "NEARBY_PLACE_POST", "3h-old gallery photo is not live");
Check(GalleryMediaPolicy.CapTrust("VERIFIED_LIVE", true, t0.AddMinutes(-30), t0) == "VERIFIED_LIVE", "fresh photo stays live");
Check(GalleryMediaPolicy.CapTrust("VERIFIED_LIVE", false, t0.AddHours(-3), t0) == "VERIFIED_LIVE", "no media, no cap");
Check(GalleryMediaPolicy.CapTrust("NEARBY_PLACE_POST", true, t0.AddMinutes(-1), t0) == "NEARBY_PLACE_POST", "a capture time never raises trust");
Check(GalleryMediaPolicy.CapTrust(null, true, t0.AddHours(-3), t0) is null, "coordinate signal untouched");
Check(SensitivePlacePolicy.BlocksMedia("EDUCATION") && SensitivePlacePolicy.BlocksMedia("education") && !SensitivePlacePolicy.BlocksMedia("HEALTH") && !SensitivePlacePolicy.BlocksMedia(null), "media blocked only at EDUCATION");

if (args.Contains("--catalog"))
{
    using var http = new HttpClient { BaseAddress = new Uri("http://localhost:5080"), Timeout = TimeSpan.FromSeconds(30) };
    (await http.GetAsync("/health")).EnsureSuccessStatusCode();
    var user = "geometry_" + Guid.NewGuid().ToString("N")[..12];
    var registration = await http.PostAsJsonAsync("/api/auth/register", new { userName = user, email = user + "@blinkr.local", password = "BlinkrSmoke!2026" });
    registration.EnsureSuccessStatusCode();
    var auth = await registration.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    http.DefaultRequestHeaders.Authorization = new("Bearer", auth.GetProperty("token").GetString());
    var catalog = new MongoClient("mongodb://localhost:27017").GetDatabase("BlinkrPlaces").GetCollection<BsonDocument>("places");
    var places = await catalog.Find(new BsonDocument { { "ExternalProvider", "osm" }, { "GeometryWkt", new BsonDocument("$type", "string") } }).ToListAsync();
    Check(places.Count > 1000, "real catalog geometry backfill exists");
    var found = false;
    foreach (var place in places)
    {
        var geometry = new WKTReader().Read(place["GeometryWkt"].AsString);
        if (!geometry.IsValid) continue;
        var lat = place["Latitude"].ToDouble(); var lon = place["Longitude"].ToDouble();
        var boundary = geometry.Coordinates.FirstOrDefault(c =>
            policy.Evaluate(new("Crowd", lat, lon, c.Y, c.X, 1)).DistanceMeters > 500);
        if (boundary is null) continue;
        var response = await http.PostAsJsonAsync("/api/posts/place-presence", new { placeId = place["_id"].AsString, latitude = boundary.Y, longitude = boundary.X, accuracyMeters = 1 });
        response.EnsureSuccessStatusCode();
        var decision = await response.Content.ReadFromJsonAsync<PlaceProximityDecision>();
        Check(decision?.TrustLevel == "VERIFIED_LIVE", "real polygon boundary verifies despite centroid over 500m away");
        Console.WriteLine("GeometryPlaceId=" + place["_id"]);
        found = true; break;
    }
    Check(found, "large real OSM geometry tested through Gateway");
    var branches = await catalog.Find(new BsonDocument("Name", new BsonRegularExpression("^b[iIİı]m$", "i"))).Limit(100).ToListAsync();
    var branchTested = false;
    foreach (var branch in branches)
    {
        var lat = branch["Latitude"].ToDouble(); var lon = branch["Longitude"].ToDouble();
        var url = FormattableString.Invariant($"/api/places/search?q=B%C4%B0M&lat={lat:R}&lon={lon:R}");
        var result = await http.GetFromJsonAsync<System.Text.Json.JsonElement[]>(url);
        var ids = result!.Select(p => p.GetProperty("id").GetString()).ToArray();
        if (ids.Length < 2) continue;
        Check(ids.Contains(branch["_id"].AsString) && ids.Distinct().Count() == ids.Length, "real same-name BIM branches retain distinct exact PlaceIds");
        branchTested = true; break;
    }
    Check(branchTested, "same-name real catalog search tested");
}
