# Son kalınan yer — 2026-10-03

> Yeni oturuma buradan başla. Ayrıntılı devir notu: `docs/blinkr-v2/HANDOFF_2026-10-03.md`.
> Dal: `feat/blinkr-theme-redesign` · Son commit'ler push edildi · Çalışma ağacı temiz (yalnız `api.ts` yerel IP, commit'lenmez).

## Kısaca durum
Bugün **Docker açılmadı, test çalıştırılmadı** (kullanıcının isteği). Her adımda yalnız derleme, `typecheck`, i18n taraması
yapıldı. Yani aşağıdakilerin hepsi **yazıldı ve derleniyor, ama gerçek sunucuda hiç çalışmadı.**

## Bugün eklenenler
| Alan | Ne | Karar |
|---|---|---|
| Sohbet | Snapchat tarzı liste (üst satır, arama, uzun basma menüsü, okunmamış rozeti, sağa çekip yanıt) | — |
| Sohbet | Sabitle (3) / sessize al | D-033 |
| Sohbet | Canlı yer kartı, kayıtlı yerden ve yer sayfasından paylaşım | D-034 |
| Sohbet | "Buluşalım" kartı (yer + saat, Geliyorum / Olmaz) | D-035 |
| Profil | Paylaş + QR, arkadaşlar simgesi, tamamlama kartı, yapışkan sekmeler, "konumda doğrulanmış N sinyal" | D-036 |
| Niş 1 | Yerin Ritmi (yoğunluk saatleri, k-anonim) | D-037 |
| Niş 2 | Haber ver (yer izleme, olay güdümlü, bir kez bildirir) | D-038 |
| Niş 3 | Yere sor (yalnız konumda doğrulanmış sinyal yanıtlar) | D-039 |
| Niş 4 | Yer özellikleri (solan bilgi, yalnız doğrulanmış ziyaretçi) | D-040 |
| Niş 6 | Koleksiyonlar (özel / bağlantıyla, canlı durumlu) | D-041 |
| Düzeltme | Sinyal değerleri büyük/küçük harf duyarsız ("Busy" = "BUSY") — ritim, izleme, bildirim, canlı durum | — |
| Doğrulama | `scripts/test-niche-features.ps1` (BLK-NICHE-01), `scripts/seed-place-rhythm.ps1`, `tests/PlacePosting` birim durumları | — |

Kararların tamamı: `docs/sinyal-mvp-plan/docs/plan/DECISIONS.md` · Niş yol haritası: `docs/blinkr-v3/NIS_OZELLIKLER.md`

## Bir sonraki oturumun İLK işi: doğrulama
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-blinkr-dev.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-niche-features.ps1      # D-033…D-041
dotnet run --project tests\PlacePosting                                          # hesaplayıcı birim durumları
dotnet run --project src\Tools\Blinkr.Tools.EventContracts                       # 2 yeni olay sözleşmesi
cd src\Clients\Blinkr.Expo; npm run test:nearby; npm run test:i18n; npm run test:ui
```
Kırmızı çıkan her madde bugünkü işin hatasıdır; yeni özellikten önce onlar düzeltilir.

Telefonda bakılacaklar: sohbette balonu sağa çekip yanıt (sayfa geri hareketiyle çakışma), profilde QR tarama, yapışkan
sekmeler, yer sayfasındaki kartlar (ritim / özellikler / Haber ver / Yere sor / Koleksiyona ekle). Ritim grafiğini dolu
görmek için: `scripts\seed-place-rhythm.ps1 -PlaceId <id>` (geri almak için `-Remove`).

## Dikkat
- IdentityService ilk açılışta `AddPlaceCollections` migration'ını uygular (yalnız 2 yeni tablo); henüz veritabanında denenmedi.
- Push bildirimi yok (G1): Haber ver ve Yere sor bildirimleri yalnız uygulama içinde.
- Koleksiyon ekranında canlı durum yalnız ilk 20 yer için.

## Sonra (sırayla)
1. Doğrulama ve çıkan hataların düzeltilmesi (yukarıda).
2. Niş 5: **Yerel rehber** — doğrulanmış katkıdan açıklanabilir mahalle rozeti (sıralama tablosu yok, seri yok).
3. Sinyal sabitleme (profil P5) — önerilen tasarım: BlogService sahibi, ayrı `author_pins` koleksiyonu.
4. Harita kromu (H5, H7, H6, H4).

## Değişmeyen kurallar
- `api.ts` yerel IP commit'lenmez: commit öncesi `.106`, sonra `.35`.
- Özel dosyalar commit'e girmez (`.idea/`, `docs/BLINKR_*`, `docs/blinkr_tema_kod/`, `docs/new/`, `docs/blinkr-devam-plani/`, `BLINKR_UYGULAMA_PLANI.md`).
- Metin `tx()` (tr + en), renk `theme.ts`, yeni tam ekran `ui/PushScreen`; her karar `DECISIONS.md`'ye; commit sonu `Co-Authored-By`, ardından push.
