# Canlı Halka — uygulama planı ve uyumsuzluklar (2026-10-04)

Kaynak: `docs/blinkr-v4/BLINKR_REDESIGN_BRIEF.md` + `blinkr-design-pack/`. Referans kod (`code/`) kopyalanmaz,
mevcut yapıya uyarlanır. Her adım ayrı commit.

## Mevcut yapıyla uyumsuzluklar (ve kararlar)

| # | Referans kod varsayımı | Gerçek | Karar |
|---|---|---|---|
| U1 | `useThemeMode()` hook'u, tema canlı değişir | Yok. Token tabloları açılışta `applyThemeMode` ile yerinde doldurulur, tercih değişince uygulama yeniden yüklenir | `liveColors` tablosu `applyThemeMode` içinde doldurulur; bileşenler `liveColors[kind]` okur (hook yok). `liveColorsDark/Light` test için ayrıca dışa açık |
| U2 | `gradientAngle` | `gradientDirection` | `gradientDirection` kullanılır |
| U3 | `tx` `../../i18n`'den | `src/i18n/tx.ts`; namespace listesi sabit (`index.ts`, `i18n-keys.test.ts`) | `live` ve `quick` namespace'leri üç yere de eklenir |
| U4 | Sinyal türleri `Open/Deal/Temp/Observation` | Sunucu yalnız `GeneralObservation, Crowd, Queue, Event, Offer, NewOpening, TemporaryStatus` kabul eder (`CreatePostDtoValidator`) | Hızlı sinyal kareleri gerçek türlere eşlenir: Açık/Kapalı→`TemporaryStatus` (Open/Closed), Fırsat→`Offer`, Gözlem→`GeneralObservation`, Geçici durum→`TemporaryStatus`+`Notice` |
| U5 | Doluluk `Calm/Busy/Crowded` (Busy = hareketli) | Gerçek: `Calm` (Sakin), `Moderate` (Hareketli), `Busy` (**Kalabalık**); eski veri `EMPTY`, `BUSY` | `CROWD_LEVELS`: calm/empty→0, moderate→1, busy/crowded/packed/full→2 |
| U6 | Bekleme `None/Short/Long` | Gerçek: `None`, `5To15`, `Over15`; eski `LONG` | `QUEUE_LEVELS`: none→0, 5to15/short/medium→1, over15/long→2 |
| U7 | `identityDisclosure: 'Anonymous'` | `AnonymousMap` (başkası 400) | `Anonymous` → `AnonymousMap` |
| U8 | Not ≥3 karakter | Sunucu: içerik boş değilse ≥5 karakter | Not eşiği 5 |
| U9 | Etkinlik/Fırsat/Yeni açılış değersiz | Sunucu `GeneralObservation` dışında `signalValue` zorunlu | Otomatik değer: Event→`Started`, Offer→`Available`, NewOpening→`Opened`, Notice |
| U10 | `mediaIds` | Gövde `media: [{ mediaId }]`; yayın `shareOutbox` (arka plan) üzerinden | Hızlı sinyal mevcut giden kutusu yolunu kullanır, yeni endpoint yok |
| U11 | Yer listesinde son N sinyal + `hoursOpen` | Yok (bkz. Soru 2) | Halka sunucunun `currentState` özetinden kurulur (`liveStateFromCurrent`); `computeLiveState` testli yedek olarak kalır; saat tahmini (kesikli) veri gelene kadar hiç oluşmaz |
| U12 | "Nöbetçi" çipi | Nöbetçi eczane verisi yok | Çip konmaz |
| U13 | `useReducedMotion` | Reanimated 4 mevcut | Aynen kullanılır |
| U14 | Lint | Projede ESLint yok | `npm run lint` = ham hex/rgba taraması (`scripts/lint-ui.cjs`, sanat dosyaları istisna) + `i18n-scan --max 0` |
| U15 | Harita `tracksViewChanges={false}` "korunur" | Şu an hiç verilmiyor (varsayılan true) | 4. adımda eklenir, `key` durum/tazelik kovasıyla değişir |

## Adımlar (brif §6)

1. Tokens + mantık + testler (`src/theme.ts`, `src/live/*.ts`, `scripts/live-*.test.ts`, `test:live` CI'da) — Opus
2. `LiveRing`, `StatusPill`, `liveLabels`, i18n (`live`, `quick`) — blinkr-impl
3. `PlaceStatusCard` → Arama ve Sohbet yer kartı — blinkr-impl
4. Harita: `LivePin`, `ClusterRing`, `NowChips`, `NearbyNowSheet`, 60 sn'lik yalnız-değişen yeniden çizim — Opus
5. Yer Detay yeniden düzen — blinkr-impl
6. `QuickSignalSheet` (+) akışına; eski composer "Gönderi" olarak uzun basmada — blinkr-impl
7. Keşfet / Profil / Sohbet / Ayarlar — blinkr-impl
8. Cila: boş/yükleniyor/hata, açık tema, büyük yazı — blinkr-impl

Her adım: `typecheck`, `lint`, `test:theme`, `test:live`, `test:i18n`, ilgili testler; sonra blinkr-reviewer.
