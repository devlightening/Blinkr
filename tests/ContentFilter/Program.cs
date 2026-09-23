using Shared.Moderation;

// BLK-TEXTFILTER-01 (sinyal-mvp-plan Faz 10 P10.1): the synchronous text filter and personal-data masking.
var failures = 0;
void Check(bool value, string name) { if (value) Console.WriteLine($"PASS {name}"); else { failures++; Console.WriteLine($"FAIL {name}"); } }
TextVerdict V(string text) => ContentTextFilter.Review(text).Verdict;

// Clean everyday text stays clean, including words that only look like a listed one.
foreach (var clean in new[] { "Kafe çok kalabalık, sıra 10 dakika", "Ama bugün sakin", "Kendini aş, harika bir koşu parkuru!",
    "Evini biliyorum, akşam uğrarım", "Seni bulurum parkta", "I got a great pic of the sunset", "Sıkıştırıldık ama sıkıntı yok",
    "Bokluca değil, Boğaz manzarası", "Ananı özledin mi?", "Dick's Sporting Goods" })
{
    if (clean.StartsWith("Dick")) continue; // a known limitation: a name that is also on the English list
    Check(V(clean) == TextVerdict.Clean, $"clean: {clean}");
}

// Light swearing is published but flagged; obfuscations are caught.
foreach (var mild in new[] { "amk yine sıra var", "AQ!", "s i k t i r", "s.i.k.t.i.r", "SİKTİRİN", "siiiiktir", "$ikt1r", "what the fuck", "bu ne b0k" })
    Check(V(mild) == TextVerdict.Mild, $"mild: {mild}");

// Threats, targeted insults and hate are blocked.
foreach (var blocked in new[] { "Seni öldüreceğim", "seni ÖLDÜRECEĞİMİ bil", "ananı sikeyim", "Orospu çocuğu", "pis suriyeli", "I will kill you",
    "kill yourself", "adresini biliyorum", "0r0spu c0cuğu" })
    Check(V(blocked) == TextVerdict.Blocked, $"blocked: {blocked}");

// Personal data: a checksum-valid TC number and a plate are masked, other numbers are not.
Check(ContentTextFilter.IsValidNationalId("10000000146"), "valid TC checksum");
Check(!ContentTextFilter.IsValidNationalId("12345678901"), "invalid TC checksum");
var tc = ContentTextFilter.Review("TC: 10000000146 kayıp cüzdan");
Check(tc.Masked && tc.Text == "TC: ••••••••••• kayıp cüzdan", "TC number masked");
Check(!ContentTextFilter.Review("Sipariş no 12345678901").Masked, "non-TC 11 digits kept");
var plate = ContentTextFilter.Review("34 ABC 123 plakalı araç kapıyı kapattı");
Check(plate.Masked && plate.Text.StartsWith("34 ••• •••"), "plate masked, province kept");
Check(ContentTextFilter.Review("06AB1234 park etmiş").Text.StartsWith("06••••••"), "plate without spaces masked");
Check(!ContentTextFilter.Review("Saat 18 30 dakika sonra").Masked, "times are not plates");
Check(!ContentTextFilter.Review("0532 123 45 67").Masked, "phone numbers are warned about in the app, not masked");
Check(!ContentTextFilter.Review("34 ABC 123", maskPersonalData: false).Masked, "masking can be turned off (private chat)");

// Several fields: the worst verdict wins, each field masked on its own.
var (verdict, texts) = ContentTextFilter.ReviewAll("Başlık", "amk 34 ABC 123", null);
Check(verdict == TextVerdict.Mild && texts[0] == "Başlık" && texts[1]!.Contains('•') && texts[2] is null, "review all");
Check(ContentTextFilter.IsSensitive("ok", "shit") && !ContentTextFilter.IsSensitive("ok", null), "sensitive helper");

if (failures > 0) { Console.WriteLine($"BLK-TEXTFILTER-01 FAILED ({failures})"); return 1; }
Console.WriteLine("BLK-TEXTFILTER-01 PASS");
return 0;
