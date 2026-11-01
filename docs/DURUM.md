# Blinkr — Güncel Durum

**Son güncelleme:** 2026-11-01 · **Dal:** `chore/faz0-zemin` (taban `feat/blinkr-v4-device-fixes`) · **Expo SDK 58** (RN 0.88)

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

## Yol haritası (D-043: yer önce, sosyal destek)
Rakip mekanizmaları uyarlanır, kopyalanmaz: Waze (teyit, gizli itibar), Google Maps (normalde/şu an, k-anonim eşik, semt yoğunluğu), Snap Map (ısı katmanı, katmanlar, özel müdavim rozeti), Instagram Map (opt-in, gizli yerler). **Yok:** seri, açık sıralama, canlı arkadaş konumu, zorunlu günlük bildirim.

| Faz | İçerik | Durum |
|---|---|---|
| 0 Zemin | SDK 58 ✅ · app config tek kaynak + splash ✅ · tazelik tek kaynak (D-042) ✅ · `eas.json` + dev build ⏳ (Expo hesabı + Apple Developer gerekli) · Sentry ⏳ (DSN gerekli) · feature flag · backend TODO temizliği | Devam |
| 1 Gerçek uygulama hissi | push bildirimi (Haber ver, Yere sor, mesaj, istek, yorum), konum izni öncesi değer kartı, iskelet/boş/hata tutarlılığı, açılış süresi, Keşfet sekmesi TODO | — |
| 2 Harita | ısı katmanı (k-anonim), "normalde vs şu an", semt yoğunluğu, katman seçici, pin okunurluğu, asla boş harita | — |
| 3 Sinyal | yakın yer istemi (uygulama açıkken, yer başına günde 1), "Hâlâ böyle mi?" öne çıkar, ≤ 2 dokunuş hızlı sinyal, "sinyalin N kişiye yardım etti" | — |
| 4 Güven | gizli itibar puanı, Yerel rehber rozeti, özel müdavim rozeti, sahte konum önlemleri | — |
| 5 Sosyal yere bağlanır | Keşfet yer gruplu, yer hikâyeleri, opt-in arkadaş etkinliği + gizli yerler, sohbet cilası | — |
| 6 Operasyon | web moderasyon paneli, PostHog, katalog + açılış saatleri, destek e-postası, KVKK | — |

Ayrıca bekleyenler: cihazda doğrulama ve katalog coverage (yukarıda), sinyal sabitleme (profil P5), harita kromu (H4–H7).

## Yayın öncesi açıklar
Destek adresi `{{DESTEK_EPOSTA}}` · Sentry/PostHog anahtarları · `.env` izlemeden çıkarılmalı · görsel moderasyon ertelendi (D-015) · push bildirimi yok · EventStore kalıcı silme operasyonu · üretim dağıtımı başlamadı. Kontrol listesi: `docs/operations/release-checklist.md`.

## Çalışma kuralları
- `api.ts` yerel IP commit'lenmez (commit öncesi `.106`, sonra `.35`).
- Özel/izlenmeyen dosyalar commit'e girmez (`.idea/`, `docs/blinkr-v4/GNC Data*`, `blinkr-design-pack/`).
- Metin `tx()` (tr + en), renk `theme.ts`, yeni tam ekran `ui/PushScreen`; her karar `DECISIONS.md`'ye; commit sonu `Co-Authored-By`.
- Bu dosya her oturum sonunda güncellenir.

## Doküman haritası (kalanlar)
`CLAUDE.md` · `docs/DURUM.md` · `docs/BLK-PRODUCT-08.md` · `docs/architecture-cqrs-es.md` · `docs/plan-devam/PROGRESS_DEVAM.md` · `docs/blinkr-v3/NIS_OZELLIKLER.md` · `docs/blinkr-v4/*` · `docs/operations/*` · `docs/sinyal-mvp-plan/docs/plan/00–14 + DECISIONS.md` · `scripts/README.md` · `src/Clients/Blinkr.Expo/README.md`
