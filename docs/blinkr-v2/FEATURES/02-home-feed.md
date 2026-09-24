# 02 — Keşfet (ana akış)

## Yapı
```
┌──────────────────────────────────┐
│ Blinkr            🔔(etkinlik) ✉ │  başlık: logo + Etkinlik + (opsiyonel) arama
│ ◯Hikayen ◯ayse ◯mert ◯elif …     │  StoryTray (gradyan halkalar)
│ [Yakınımda] [Takip] [Yerler] [#] │  segment (hap)
│ ┌──────────────────────────────┐ │
│ │ ◯ ayse · Soulmate Kafe · 5dk ⋯│ │  FeedCard başlık
│ │ ┌──────────────────────────┐ │ │
│ │ │        medya 4:5         │ │ │  karusel, • • ∘ göstergesi
│ │ └──────────────────────────┘ │ │
│ │ ♡ 💬 ➤              🔖       │ │  eylemler
│ │ ❤️🔥 128 · Kalabalık: Sakin   │ │  tepki özeti + sinyal rozeti
│ │ ayse Bahçede boş masa… devamı │ │  RichText
│ │ 12 yorumun tümünü gör         │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

## Veri
- `GET /api/discover/nearby?lat&lon&page` — tazelik > yakınlık > log(etkileşim); kişi başı sayfada ≤ 2; en fazla 10 sayfa.
- `GET /api/discover/following?page` — son 7 gün, anonim yok.
- `GET /api/discover/hashtag/{tag}` (V2).
- Sayfa hatasında son liste kalır; aşağı çek yenile.

## Etkileşim
| Hareket | Sonuç |
|---|---|
| Çift dokunma medya | ❤️ tepkisi + ortada gradyan kalp animasyonu (iyimser; hata → geri al + toast) |
| Kalbe uzun basma | 6 emoji balonu |
| 💬 | `PostFullView` yorumlara kaydırılmış |
| ➤ | Paylaşım menüsü (FEATURES/05 §5) |
| Başlık avatarı/adı | `UserProfileSheet` |
| Yer adı | Haritada göster |
| Görünür ≥ 1 sn | görülme kuyruğu (10 sn'de bir toplu) |

## Performans
FlatList: `windowSize 7`, `initialNumToRender 3`, `removeClippedSubviews`; video yalnız en görünür kartta oynar
(`onViewableItemsChanged`, %60 eşik), diğerleri duraklar ve belleği serbest bırakır.

## Kabul
- [ ] Sahne `discover-feed` koyu/açık; çift dokunma animasyonu; tepki balonu; boş/hata durumu.
- [ ] `scripts/test-discover.ps1` (mevcut) PASS.
