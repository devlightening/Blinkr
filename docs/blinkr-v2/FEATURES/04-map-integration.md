# 04 — Harita ve gönderi pop-up'ı

## Mevcut
Harita açılış ekranı; `GET /api/map/bounds` birleşik cevap; 4 katman (Tümü/Canlı/Yerler/Sinyaller) + tür
filtreleri; supercluster kümeleri; pin → `SignalCardModal` (alttan yükselen kart); arama; liste görünümü.

## V2: kart → tam sayfa
```
 Harita                  Kart (durak 1)                 Tam sayfa (durak 2)
┌─────────┐   pin    ┌─────────────────┐   yukarı   ┌─────────────────┐
│  • •    │ ───────► │ harita (karartı)│ ─────────► │ ← ayse    ⋯     │
│    •    │          │┌───────────────┐│            │ ┌─────────────┐ │
│         │          ││ yer şeridi 1/3││            │ │ medya/video │ │
│         │          ││ medya         ││ ◄───────── │ └─────────────┘ │
│         │          ││ ❤ 💬 ➤ 🔖     ││   aşağı    │ açıklama (tam)  │
└─────────┘          │└───────────────┘│            │ ❤ tepkiler      │
                     └─────────────────┘            │ yorumlar ↕      │
                                                    │ [yorum yaz…] ➤  │
                                                    └─────────────────┘
```
Tek `progress` değeri iki durak arası yorumlanır (0 kapalı, 1 kart, 2 tam sayfa):
```ts
const cardStyle = useAnimatedStyle(() => {
  const e = interpolate(progress.value, [1, 2], [0, 1], Extrapolation.CLAMP);   // genişleme oranı
  return {
    top: interpolate(e, [0, 1], [screenH - cardH - CARD_MARGIN - insets.bottom, 0]),
    left: interpolate(e, [0, 1], [CARD_MARGIN, 0]),
    right: interpolate(e, [0, 1], [CARD_MARGIN, 0]),
    bottom: interpolate(e, [0, 1], [CARD_MARGIN + insets.bottom, 0]),
    borderRadius: interpolate(e, [0, 1], [radii.xl, 0]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [cardH, 0], Extrapolation.CLAMP) + drag.value }],
  };
}, [progress, drag, cardH]);
```
- Jest başlıktan ve (tam sayfada) içerik en üstteyken içerikten; `simultaneousWithExternalGesture` ile ScrollView.
- Bırakınca hıza göre en yakın durak; tam sayfadan 120 pt aşağı → kart; karttan 120 pt aşağı → kapat.
- Tam sayfada içerik `PostFullView`; kart görünümünde mevcut `SignalCard`. Geçişte medya aynı kalır (yeniden yüklenmez).
- Android geri tuşu: tam sayfa → kart → kapat.

## Yarıçap filtresi (V2)
Filtre satırına "Yakınımda" çipi: 500 m / 1 km / 3 km / 10 km. Seçilince harita o yarıçapı kaplayacak şekilde
kişinin konumuna odaklanır ve dışarıdaki pinler soluklaşır (%35). Sunucu değişmez (bounds zaten viewport).

## Kümeleme
Mevcut supercluster; zoom < 16 dokununca yakınlaş, ≥ 16 kümedeki sinyaller kart sayfaları. Küme görseli koyu
temada gradyan kenarlı disk.

## Derin bağlantı
`blinkr://post/{id}` ve `https://blinkr.app/p/{id}` (sonra) → `GET /api/posts/{id}` → haritayı konuma getir,
tam sayfa aç. `app.json` → `"scheme": "blinkr"`; `Linking.getInitialURL` + `addEventListener('url')`.

## Kabul
- [ ] Sahneler: `signal-card` (kart), `signal-card-full` (tam sayfa, yorumlar), `signal-card-video`.
- [ ] `scripts/test-signal-card.ps1`, `test-location-map-core.ps1` PASS.
- [~] Cihaz: sürükleme akıcılığı, geri tuşu.
