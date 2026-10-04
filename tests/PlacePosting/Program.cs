using BlogService.Application.Services;
using Microsoft.Extensions.Options;
using PlaceService.Api.Application;
using PlaceService.Api.Domain;
using MongoDB.Driver;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
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
var forwardCompatiblePlace = BsonSerializer.Deserialize<PlaceDocument>(new BsonDocument("FutureCatalogField", true));
Check(forwardCompatiblePlace is not null, "place documents ignore additive catalog fields");
Check(At(500, 0, "POLYGON ((-0.01 -0.01, 0.01 -0.01, 0.01 0.01, -0.01 0.01, -0.01 -0.01))").TrustLevel == "VERIFIED_LIVE", "inside polygon, distant centroid");
Check(At(500, 0, "broken").TrustLevel == "NEARBY_PLACE_POST", "malformed geometry point fallback");
Check(At(500, 0, "POLYGON ((-0.02 -0.02, 0.02 -0.02, 0.02 0.02, -0.02 0.02, -0.02 -0.02), (-0.01 -0.01, -0.01 0.01, 0.01 0.01, 0.01 -0.01, -0.01 -0.01))").TrustLevel != "VERIFIED_LIVE", "polygon hole is not presence");
var now = DateTime.UtcNow;
PlaceSignalDocument Signal(string? trust, string value) => new() { PostId = Guid.NewGuid(), PlaceId = Guid.NewGuid(), PublicationTrust = trust, SignalType = "Crowd", SignalValue = value, CreatedAtUtc = now, ExpiresAtUtc = now.AddHours(3) };
var calculator = new CurrentPlaceStateCalculator();
Check(calculator.Calculate([Signal("NEARBY_PLACE_POST", "Busy")], now).ActiveSignalCount == 0, "nearby excluded from live state");
Check(calculator.Calculate([Signal(null, "Busy")], now).ActiveSignalCount == 0, "legacy unproven events fail closed");

var hours = new OpeningHoursCalculator();
var monday0830Utc = new DateTime(2026, 10, 5, 5, 30, 0, DateTimeKind.Utc); // 08:30 in Turkey
Check(hours.Calculate("Mo-Fr 08:00-18:00; Sa 10:00-14:00; Su off", monday0830Utc)?.IsOpenNow == true, "weekly opening hours are open in place time");
var monday1900Utc = new DateTime(2026, 10, 5, 16, 0, 0, DateTimeKind.Utc); // 19:00 in Turkey
var nextOpen = hours.Calculate("Mo-Fr 08:00-18:00; Sa 10:00-14:00; Su off", monday1900Utc);
Check(nextOpen?.IsOpenNow == false && nextOpen.NextOpenAtUtc == new DateTime(2026, 10, 6, 5, 0, 0, DateTimeKind.Utc), "closed hours include the next opening instant");
Check(hours.Calculate("18:00-02:00", new DateTime(2026, 10, 4, 22, 0, 0, DateTimeKind.Utc))?.IsOpenNow == true, "overnight opening hours span midnight");
Check(hours.Calculate("24/7", now)?.IsOpenNow == true, "24/7 is always open");
Check(hours.Calculate("Mo-Fr sunrise-sunset", now)?.IsOpenNow is null, "unsupported hours remain unknown rather than guessed");
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
var mixedCase = calculator.Calculate([By(alice, "Busy", 3), By(bob, "BUSY", 2), By(Guid.NewGuid(), "Calm", 1)], now);
Check(mixedCase.SignalValue?.ToUpperInvariant() == "BUSY", "\"Busy\" and \"BUSY\" are one opinion, not two split groups");

// D-038: only a real change of the visible state is news.
var detector = new PlaceStateChangeDetector(calculator);
var first = By(alice, "Busy", 1);
Check(detector.Detect([first], first.PostId, now) is not null, "the first verified signal changes an empty place");
var agree = By(bob, "BUSY", 0);
Check(detector.Detect([first, agree], agree.PostId, now) is null, "agreeing (any letter case) is not a change");
// Busy by two people; a first calm voice does not flip it, the second (newer, equal weight) does.
var busyBob = By(bob, "Busy", 1);
var turn = By(Guid.NewGuid(), "Calm", 0); var turn2 = By(Guid.NewGuid(), "Calm", 0);
Check(detector.Detect([first, busyBob, turn], turn.PostId, now) is null, "one calm voice against two busy is not a change");
Check(detector.Detect([first, busyBob, turn, turn2], turn2.PostId, now)?.SignalValue == "Calm", "a second calm voice turns the busy place calm");

// D-037: rhythm only from verified Crowd/Queue, one voice per person-hour, an hour needs three different people.
var rhythm = new PlaceRhythmCalculator();
var noon = new DateTime(2026, 9, 28, 9, 30, 0, DateTimeKind.Utc); // Monday 12:30 in Turkey
PlaceSignalDocument RhythmAt(Guid author, string value, DateTime when, string trust = "VERIFIED_LIVE") =>
    new() { PostId = Guid.NewGuid(), PlaceId = Guid.NewGuid(), AuthorId = author, PublicationTrust = trust, SignalType = "Crowd", SignalValue = value, CreatedAtUtc = when };
var r1 = rhythm.Calculate([RhythmAt(alice, "Busy", noon), RhythmAt(alice, "Busy", noon.AddMinutes(5)), RhythmAt(bob, "Busy", noon)], noon.AddDays(1));
Check(r1.Observations == 2 && !r1.Enough, "one voice per person-hour; too little history is not a rhythm");
var crowd = Enumerable.Range(0, 3).SelectMany(w => Enumerable.Range(0, 3).Select(_ => RhythmAt(Guid.NewGuid(), "BUSY", noon.AddDays(-7 * w)))).ToList();
var r2 = rhythm.Calculate(crowd, noon.AddDays(1));
var mondayNoon = r2.Days.First(d => d.Weekday == 1).Hours.First(h => h.Hour == 12);
Check(r2.Enough && mondayNoon.Level == 1.0, "three people a week, three weeks: Monday 12:00 reads busy (upper-case counted)");
Check(r2.Days.First(d => d.Weekday == 1).Hours.First(h => h.Hour == 13).Level is null, "an hour with nobody stays empty, not quiet");
var lonely = crowd.Take(8).Append(RhythmAt(alice, "Calm", noon.AddHours(3))).ToList();
Check(rhythm.Calculate(lonely, noon.AddDays(1)).Days.First(d => d.Weekday == 1).Hours.First(h => h.Hour == 15).Level is null, "one person's hour is never shown (k-anonymity)");
Check(rhythm.Calculate([.. crowd, RhythmAt(bob, "Calm", noon, "NEARBY_PLACE_POST")], noon.AddDays(1)).Observations == r2.Observations, "unverified signals never shape the rhythm");

// D-040: facts fade - recent answers outweigh old ones, and forgotten ones disappear.
var facts = new PlaceAttributeCalculator();
PlaceAttributeVoteDocument Vote(Guid user, bool value, int daysAgo) => new() { PlaceId = Guid.NewGuid(), Key = "wifi", UserId = user, Value = value, VotedAtUtc = now.AddDays(-daysAgo) };
var wifi = facts.Calculate([Vote(alice, false, 90), Vote(bob, true, 1)], alice, now).Single();
Check(wifi.State == "yes" && wifi.Voters == 2 && wifi.MyVote == false, "a fresh yes outweighs a 90-day-old no; my own vote is mine");
Check(facts.Calculate([Vote(alice, true, 70)], null, now).Single().Fading, "unconfirmed for 60+ days is fading");
Check(facts.Calculate([Vote(alice, true, 200)], null, now).Count == 0, "after 180 days it is forgotten");

// P5.11: an old gallery photo can only lower trust, never raise it.
var t0 = new DateTime(2026, 9, 23, 12, 0, 0, DateTimeKind.Utc);
Check(GalleryMediaPolicy.CapTrust("VERIFIED_LIVE", true, t0.AddHours(-3), t0) == "NEARBY_PLACE_POST", "3h-old gallery photo is not live");
Check(GalleryMediaPolicy.CapTrust("VERIFIED_LIVE", true, t0.AddMinutes(-30), t0) == "VERIFIED_LIVE", "fresh photo stays live");
Check(GalleryMediaPolicy.CapTrust("VERIFIED_LIVE", false, t0.AddHours(-3), t0) == "VERIFIED_LIVE", "no media, no cap");
Check(GalleryMediaPolicy.CapTrust("NEARBY_PLACE_POST", true, t0.AddMinutes(-1), t0) == "NEARBY_PLACE_POST", "a capture time never raises trust");
Check(GalleryMediaPolicy.CapTrust(null, true, t0.AddHours(-3), t0) is null, "coordinate signal untouched");
Check(SensitivePlacePolicy.BlocksMedia("EDUCATION") && SensitivePlacePolicy.BlocksMedia("education") && !SensitivePlacePolicy.BlocksMedia("HEALTH") && !SensitivePlacePolicy.BlocksMedia(null), "media blocked only at EDUCATION");

// Faz 7: the nearby feed puts fresh and close first, lets engagement only nudge, and spreads authors out.
var n0 = new DateTime(2026, 9, 23, 12, 0, 0, DateTimeKind.Utc);
DiscoverRanking.Candidate Cand(Guid author, double minutesAgo, double meters, int likes = 0, bool anon = false) => new(Guid.NewGuid(), author, anon, n0.AddMinutes(-minutesAgo), meters, likes, 0);
var ann = Guid.NewGuid(); var bo = Guid.NewGuid(); var cem = Guid.NewGuid();
Check(DiscoverRanking.Score(Cand(ann, 5, 300), n0) > DiscoverRanking.Score(Cand(ann, 300, 300, likes: 500), n0), "a fresh signal beats an old popular one");
Check(DiscoverRanking.Score(Cand(ann, 10, 200), n0) > DiscoverRanking.Score(Cand(ann, 10, 5000), n0), "closer ranks higher at the same age");
var spread = DiscoverRanking.Order(new[] { Cand(ann, 1, 100), Cand(ann, 2, 100), Cand(ann, 3, 100), Cand(bo, 30, 900), Cand(cem, 60, 2000) }, n0, 4);
Check(spread.Take(4).Count(c => c.AuthorId == ann) == 2 && spread.Count == 5, "at most two per person per page, nothing dropped");
var anons = DiscoverRanking.Order(new[] { Cand(ann, 1, 100, anon: true), Cand(ann, 2, 100, anon: true), Cand(ann, 3, 100, anon: true) }, n0, 3);
Check(anons.Count == 3, "anonymous signals are not grouped by their hidden author");
Check(DiscoverRanking.CoarseDistance(12) == 50 && DiscoverRanking.CoarseDistance(137) == 150 && DiscoverRanking.CoarseDistance(1024) == 1000, "feed distances are coarse");

if (args.Contains("--catalog"))
{
    using var http = new HttpClient { BaseAddress = new Uri("http://localhost:5080"), Timeout = TimeSpan.FromSeconds(30) };
    (await http.GetAsync("/health")).EnsureSuccessStatusCode();
    var user = "e2e_geometry_" + Guid.NewGuid().ToString("N")[..12];
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
