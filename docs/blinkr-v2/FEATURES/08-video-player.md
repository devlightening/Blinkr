# 08 — Video oynatıcı

## Gereksinim
Kartta ve tam sayfada video akıcı oynamalı; oynat/duraklat, ilerleme sürükleme, hız, ses, tam ekran.

## Tasarım
```
minimal (kart, akış)                    full (tam sayfa, MediaViewer)
┌──────────────────────┐                ┌──────────────────────────────┐
│                  🔇  │                │ ✕                        ⋯   │
│         ▶            │                │                              │
│                      │                │            ▶ / ⏸             │
│ ▬▬▬▬▬▬▬───────────── │ (2pt çubuk)    │ 0:12 ●━━━━━━━━───────── 0:45  │
└──────────────────────┘                │ 🔊   1x   ⛶                   │
                                        └──────────────────────────────┘
```

## Uygulama (`signal/VideoPlayer.tsx`)
```tsx
export function VideoPlayer({ uri, autoPlay = true, muted = true, loop = true, controls = 'minimal' }: Props) {
  const player = useVideoPlayer(uri, (p) => { p.loop = loop; p.muted = muted; p.timeUpdateEventInterval = 0.25; if (autoPlay) p.play(); });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const [rate, setRate] = useState(1);
  const cycleRate = () => { const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; player.playbackRate = next; setRate(next); };
  // scrub: Gesture.Pan → x/width * player.duration → player.currentTime = t (sürüklerken duraklat, bırakınca devam)
  return (
    <View>
      <VideoView player={player} nativeControls={false} contentFit="contain" allowsFullscreen allowsPictureInPicture={false} />
      <ControlsOverlay /* 3 sn hareketsizlikte solar */ />
    </View>
  );
}
const RATES = [1, 1.25, 1.5, 2, 0.5];
```
- Görünürlük: akışta `isActive` prop'u; görünür değilse `player.pause()`. Ekrandan tamamen çıkınca `player.replace(null)` değil,
  bileşen unmount (FlatList sanallaştırması) — bellek serbest.
- Ses: akışta sessiz başlar (IG), 🔇'ye dokununca tüm oturum için sesli (`videoAudioPreference` bellek durumu).
- Tam ekran: `MediaViewer` (mevcut) `controls="full"` ile; yatay döndürme serbest.
- Hata: poster + "Video oynatılamadı" + tekrar dene.
- a11y: oynat/duraklat, ses, hız düğmeleri etiketli; ilerleme `accessibilityRole="adjustable"` ±5 sn.

## Önbellek ve akıcılık
- `expo-video` HLS/MP4 akışı; sunucu MP4 `faststart` (moov başta) ile kaydeder → ilk kare hızlı.
- Poster (thumbnail) medya meta verisinde; video yüklenene kadar gösterilir.
- Sonraki karttaki video için oynatıcı önceden oluşturulur (`preload`), yalnız bir sonraki.

## Kabul
- [~] Sahne `video-player`: kontrol kuralları `videoControls.ts` testlerinde; oynatma/hız/sürükleme cihazda doğrulanacak
- [~] Cihaz: 60 fps kaydırma, sürükleme, hız değişimi, arka plana geçince duraklama.
