# Blinkr — Güncel Durum

**Son güncelleme:** 2026-11-01 · **Dal:** `feat/blinkr-v4-device-fixes` · **Son commit:** 2026-10-04 `a079103`

Yeni oturum buradan başlar. Mimari ve kurallar: `CLAUDE.md`. Kararlar: `docs/sinyal-mvp-plan/docs/plan/DECISIONS.md`.

## Ürün
Harita merkezli, yer odaklı mobil uygulama: "Şu an bu yerde ne oluyor, bilgi yeterince taze ve güvenilir mi?"
Backend: .NET mikroservisleri + EventStoreDB (yazma) + MongoDB (okuma) + RabbitMQ + PostgreSQL + Redis. İstemci: Expo (React Native) + TypeScript.

## Bitenler (kodda var)
| Alan | Kaynak |
|---|---|
| Faz 0–9: kayıt/giriş, harita, yakındaki yerler, sinyal, medya, arkadaşlık, sohbet, snap, koleksiyonlar | CLAUDE.md |
| Plan-devam Faz A–G: tema, sinyal kartı, kamera-öncelikli composer, balon sohbet, yaş/hesap silme/yasal, i18n tr+en, a11y, analitik | `docs/plan-devam/PROGRESS_DEVAM.md` |
| Niş özellikler D-033…D-041: sohbet sabitle/sessize, canlı yer kartı, Buluşalım, Yerin Ritmi, Haber ver, Yere sor, Yer özellikleri, Koleksiyonlar, Profil QR | `docs/blinkr-v3/NIS_OZELLIKLER.md` |
| v4 Canlı Halka (8 adım): LiveRing/StatusPill, PlaceStatusCard, harita LivePin/ClusterRing/Şimdi çipleri, yer detayı, (+) hızlı sinyal, Keşfet/Profil/Sohbet/Ayarlar | `docs/blinkr-v4/UYGULAMA_PLANI.md` |
| Cihaz düzeltmeleri: `start:lan` adaptör seçimi, "Sinyaller" pinleri, yer kataloğunda eklemeli alanlara tolerans | git log |

## Doğrulama (2026-11-01, yerel Docker + servisler)
**PASS:** `typecheck`, `lint`, `test:theme`, `test:live`, `test:nearby`, `test:i18n`, `test:ui` · `scripts/test-niche-features.ps1` (56/56, BLK-NICHE-01) · `tests/PlacePosting` · EventContracts (39 tür) · auth-gateway, güvenilir olay teslimi, nearby mesafe, yer/canlı sinyal, içerik/medya smoke testleri. `AddPlaceCollections` migration'ı sorunsuz uygulandı.
**Düzeltilen:** `test:ui` hikâye adımı eskiydi (v4 tam hikâye çubuğunu "Yakın" sekmesinden "Takip" sekmesine taşımıştı); test güncellendi, uygulama kodu değişmedi.
**Hâlâ cihazda doğrulanmadı:** iki cihazlı sinyal zinciri, sohbette sağa çekip yanıt, profilde QR, (+) hızlı sinyal, canlı halka pinleri, performans ölçümleri. Yer kataloğu coverage (Ankara/İstanbul/Osmaniye) DOWN görünüyordu; `scripts/test-place-catalog-coverage.ps1 -Strict` çalıştırılmadı.

## Sıradaki işler
1. Cihaz doğrulaması + katalog coverage kontrolü (yukarıda).
2. Fiziksel iki cihaz kabul testi, performans ölçümleri (`PROGRESS_DEVAM.md` tablosu boş).
3. Niş 5 Yerel rehber (açıklanabilir mahalle rozeti; sıralama/seri yok).
4. Sinyal sabitleme (profil P5) — BlogService sahibi, ayrı `author_pins` koleksiyonu.
5. Harita kromu (H5, H7, H6, H4).
6. Yer kataloğunu Türkiye geneline genişletme.

## Yayın öncesi açıklar
Destek adresi `{{DESTEK_EPOSTA}}` · Sentry/PostHog anahtarları · `.env` izlemeden çıkarılmalı · görsel moderasyon ertelendi (D-015) · push bildirimi yok · EventStore kalıcı silme operasyonu · üretim dağıtımı başlamadı. Kontrol listesi: `docs/operations/release-checklist.md`.

## Çalışma kuralları
- `api.ts` yerel IP commit'lenmez (commit öncesi `.106`, sonra `.35`).
- Özel/izlenmeyen dosyalar commit'e girmez (`.idea/`, `docs/blinkr-v4/GNC Data*`, `blinkr-design-pack/`).
- Metin `tx()` (tr + en), renk `theme.ts`, yeni tam ekran `ui/PushScreen`; her karar `DECISIONS.md`'ye; commit sonu `Co-Authored-By`.
- Bu dosya her oturum sonunda güncellenir.

## Doküman haritası (kalanlar)
`CLAUDE.md` · `docs/DURUM.md` · `docs/BLK-PRODUCT-08.md` · `docs/architecture-cqrs-es.md` · `docs/plan-devam/PROGRESS_DEVAM.md` · `docs/blinkr-v3/NIS_OZELLIKLER.md` · `docs/blinkr-v4/*` · `docs/operations/*` · `docs/sinyal-mvp-plan/docs/plan/00–14 + DECISIONS.md` · `scripts/README.md` · `src/Clients/Blinkr.Expo/README.md`
