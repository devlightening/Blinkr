# PERFORMANCE

## Bütçeler
| Metrik | Hedef | Bugün |
|---|---|---|
| Soğuk açılış → harita etkileşimli | < 2.5 sn (orta Android) | cihazda ölçülecek |
| Pin dokunma → kart görünür | < 150 ms | cihazda ölçülecek |
| Kart → tam sayfa geçiş | 60 fps | cihaz |
| Akış kaydırma | 60 fps, JS thread < 16 ms/kare | cihaz |
| Hikaye segment geçişi | < 100 ms (ön yüklenmişse) | cihaz |
| API p95 harita/akış | < 300 ms | 31 / 51 ms (yerel) |
| API p95 sohbet | < 300 ms | 110 ms (yerel) |
| Gerçek zaman mesaj gecikmesi | < 500 ms | < 1 sn doğrulandı (BLK-REALTIME-01, Gateway üzerinden) |
| JS paket | < 6 MB (Hermes bytecode) | **4,52 MB** Android / 4,51 MB iOS (2026-09-25; önce 6,26 MB — lucide ikonları tek tek içe aktarılıyor, `babel-plugin-lucide-icons.js`) |

## Mobil teknikler
- **Animasyon UI thread'de:** reanimated shared value + worklet; `useAnimatedStyle` bağımlılık dizisiyle.
  Jest işleyicilerinde `runOnJS` yalnız son durumda.
- **Listeler:** FlatList `keyExtractor` kararlı, `getItemLayout` sabit yükseklikli satırlarda, `React.memo` satırlar,
  `windowSize` 7, `removeClippedSubviews` (Android).
- **Görseller:** sabit en-boy kutusu (yerleşim sıçraması yok), `Image.prefetch` sonraki öğe için; blurhash/varyantlar
  sunucu tek boyut ürettiği için ertelendi — sunucu küçük önizleme ürettiğinde listelerde o kullanılır.
- **Video:** aynı anda tek oynayan oynatıcı; görünür olmayan duraklar; poster önce.
- **Harita:** marker'lar bitmap (animasyonsuz), `tracksViewChanges={false}` ilk çizimden sonra; viewport başına
  katalog yer ≤ 80; bölge değişimi 300 ms debounce + istek kimliğiyle eski cevap atılır.
- **Ağ:** stale-while-revalidate; abort ile iptal; yoklama yalnız hub yokken.
- **Başlangıç:** tema ve i18n senkron açılış; fontlar önceden; ağır ekranlar (kamera, ayarlar) ilk dokunuşta yüklenir.

## Backend teknikler
- Okuma Mongo projeksiyonundan, EventStore yeniden kurma yok.
- Redis önbellek: harita bounds (kısa TTL, gönderi olayında geçersiz).
- İndeks disiplini (`DATABASE/indexes.md`); `explain()` kontrolü.
- SignalR ölçek: çok instance'ta Redis backplane (`AddSignalR().AddStackExchangeRedis(conn)`); bağlantı başına bellek ~10 KB.
- Worker: consumer prefetch 16, idempotent upsert; hata kuyruğu görünür.

## Ölçüm araçları
- `scripts/measure-api-latency.ps1` (p50/p95).
- Cihaz: React Native Perf Monitor (fps), Flipper/Android Studio profiler, `adb shell dumpsys gfxinfo`.
- Analitik olayları (`analytics.ts`) sağlayıcı bağlanınca açılış ve etkileşim süreleri.
