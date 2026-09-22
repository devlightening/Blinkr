# 03 — Tasarım Sistemi

## 1. Tasarım ilkeleri
1. **Harita sahnedir, arayüz perdedir.** Harita ve medya her zaman ön planda; kontroller yüzen, blur'lu,
   ince katmanlar.
2. **Tek cesur öğe: Tazelik Halkası.** Uygulamanın imzası. Sinyalin kalan ömrünü gösteren ince halka;
   pinlerde, hikaye avatarlarında ve kart başlığında aynı dil. Geri kalan her şey sakin ve disiplinli.
3. **Bir bakışta anla.** Tip = ikon + renk, seviye = dolu çubuk sayısı, tazelik = halka. Metin okumadan
   durum anlaşılmalı.
4. **Hareket bir şeyi açıklar.** Animasyonlar yalnızca kullanıcının eylemine yanıt verir (açılma,
   genişleme, onay). Dekoratif, kendiliğinden oynayan animasyon yok (tek istisna: canlı pin nabzı).
5. **Marka DNA'sı korunur:** Koyu zemin + mint yeşili + güneş sarısı oluştur butonu.

## 2. Renkler

Token'lar `src/design-system/tokens/colors.ts` içinde. Bileşenler yalnızca **semantik** token kullanır.

### 2.1 Ham palet
```ts
export const palette = {
  ink950: '#07090B', ink900: '#0C1014', ink850: '#11161B', ink800: '#171D23',
  ink700: '#212932', ink600: '#2C3540', ink500: '#46515D', ink400: '#6B7682',
  ink300: '#98A2AE', ink200: '#C4CBD3', ink100: '#E6EAEE', ink50: '#F4F6F8', white: '#FFFFFF',

  mint500: '#3DDC97', mint600: '#22B97A', mint400: '#6BE8B1', mint900: '#0E2A20',
  sun500: '#FFC83D',  sun600: '#E5A800',  sun400: '#FFD86E',
  red500: '#FF5A5F',  orange500: '#FF8A4C', amber500: '#FFC83D',
  pink500: '#F472B6', violet500: '#B98BFF', sky500: '#38BDF8',
  indigo500: '#818CF8', slate500: '#8FA3BF', blue500: '#4DA3FF',
} as const;
```

### 2.2 Semantik token'lar (koyu / açık)
| Token | Koyu | Açık | Kullanım |
|---|---|---|---|
| `bg.canvas` | ink950 | white | Ekran zemini |
| `bg.surface` | ink900 | ink50 | Kart zemini |
| `bg.surfaceRaised` | ink850 | white | Modal, Sinyal Kartı |
| `bg.surfaceSunken` | ink800 | ink100 | Input, segment zemini |
| `bg.overlay` | rgba(7,9,11,0.55) | rgba(7,9,11,0.35) | Modal arkası (+ blur 20) |
| `bg.glass` | rgba(17,22,27,0.72) | rgba(255,255,255,0.78) | Yüzen bar, tab bar (+ blur) |
| `border.subtle` | rgba(255,255,255,0.06) | rgba(7,9,11,0.06) | İnce ayraç |
| `border.default` | ink700 | ink100 | Kart kenarı |
| `text.primary` | ink50 | ink950 | Ana metin |
| `text.secondary` | ink300 | ink500 | İkincil metin |
| `text.tertiary` | ink400 | ink400 | Zaman damgası, ipucu |
| `text.onAccent` | ink950 | ink950 | Mint/sarı buton üstü |
| `accent.primary` | mint500 | mint600 | Birincil eylem, aktif sekme, bağlantı |
| `accent.primarySoft` | mint900 | #DDF7EC | Seçili çip zemini |
| `accent.create` | sun500 | sun500 | (+) butonu, "Gönder" |
| `state.danger` | red500 | #E5484D | Hata, sil, Kapalı |
| `state.success` | mint500 | mint600 | Onay |
| `state.info` | blue500 | #2F7FE0 | Bilgi |

Açık tema MVP'de desteklenir (sistem ayarını izler, Ayarlar > Görünüm'den değiştirilebilir). Harita
stili temaya göre değişir.

### 2.3 Sinyal tipi renkleri
| Tip | Anahtar | Renk | İkon (lucide adı) |
|---|---|---|---|
| Doluluk | `crowd` | orange500 | `users` |
| Bekleme | `wait` | amber500 | `clock` |
| Geçici durum | `status` | red500 | `triangle-alert` |
| Trafik & yol | `traffic` | pink500 | `car` |
| Etkinlik | `event` | violet500 | `party-popper` |
| Hava | `weather` | sky500 | `cloud-sun` |
| Park yeri | `parking` | indigo500 | `square-parking` |
| Gözlem | `observation` | slate500 | `eye` |

### 2.4 Seviye skalası (doluluk, bekleme, trafik, park için)
`level.0 = mint500` (sakin/az), `level.1 = #D9E36B` (orta), `level.2 = orange500` (yoğun),
`level.3 = red500` (çok yoğun). Park yerinde skala terstir (bol = level.0).

## 3. Tipografi
- **Gövde:** Sistem fontu (iOS: SF Pro, Android: Roboto). Okunabilirlik ve performans için.
- **Başlık & rakamlar:** `Bricolage Grotesque` (Google Fonts, OFL). Profil sayaçları, yer adları,
  büyük durum etiketleri ("Kalabalık"), boş durum başlıkları. Türkçe karakterleri (ğ, ş, ı, İ, ç, ö, ü)
  kurulumdan önce test et; sorun varsa sistem fontuna düş ve DECISIONS.md'ye yaz.
- Rakamlar `fontVariant: ['tabular-nums']` (sayaç zıplamasın).
- Tüm metinler Dynamic Type / font ölçeğine uyumlu (maks ölçek 1.4 ile sınırla, layout kırılmasın).

| Token | Boyut / Satır | Ağırlık | Font | Kullanım |
|---|---|---|---|---|
| `display` | 30/36 | 700 | Bricolage | Profil adı, boş durum başlığı |
| `title1` | 22/28 | 700 | Bricolage | Ekran başlığı, yer adı |
| `title2` | 18/24 | 600 | Bricolage | Kart başlığı, durum etiketi |
| `headline` | 16/21 | 600 | Sistem | Kullanıcı adı, buton |
| `body` | 15/21 | 400 | Sistem | Açıklama, yorum |
| `callout` | 14/19 | 500 | Sistem | Çip, meta |
| `caption` | 12/16 | 500 | Sistem | Zaman, sayaç etiketi |
| `micro` | 11/13 | 600 | Sistem | Pin rozeti, sekme etiketi |

Kurallar: Büyük harf (ALL CAPS) etiket yok. Cümle düzeni (sentence case). Başlıkta tek kelime vurgusu yok.

## 4. Boşluk, köşe, gölge
- **Boşluk (4pt grid):** `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · 4xl 48`
- **Ekran yatay padding:** 16
- **Köşe yarıçapı (hiyerarşiye göre farklı):** `sm 8` (çip içi), `md 12` (input, küçük kart),
  `lg 20` (Sinyal Kartı medyası), `xl 28` (Sinyal Kartı dış kabı, alt sayfa), `pill 999` (çip, buton)
- **Gölge:** Koyu temada gölge yerine `border.subtle` + zemin kademesi. Açık temada yalnızca yüzen
  öğelerde tek gölge: `0 8 24 rgba(7,9,11,0.12)`.

## 5. İkonografi
- Kütüphane: `lucide-react-native` (tutarlı çizgi ikonlar), çizgi kalınlığı 2, boyutlar 16/20/24/28.
- Emoji yalnızca kullanıcı içeriğinde ve çıkartmalarda. Sistem arayüzünde (tip ikonları dahil) emoji
  yerine lucide ikonları kullanılır (mevcut 👥 ⏳ emoji'leri ikonla değiştirilir).

## 6. İmza öğe: Tazelik Halkası (`FreshnessRing`)
```
  ╭──────╮      ring = kalan ömür oranı (1.0 → 0.0), saat yönünde azalır
 │  ◉    │      renk = tip rengi
  ╰──────╯      < 15 dk yaşındaysa: 2 sn'de bir hafif nabız (opacity 1→0.5, scale 1→1.15)
```
- Props: `size`, `progress (0–1)`, `color`, `live: boolean`, `children`
- Skia veya `react-native-svg` ile çizilir; progress her 30 sn güncellenir (her karede değil).
- Kullanıldığı yerler: harita pini, hikaye avatarı (aktif sinyal varsa), Sinyal Kartı başlığındaki
  kalan süre göstergesi, profil ızgarasındaki aktif sinyal köşesi.
- `prefers-reduced-motion` / "Hareketi Azalt" açıksa nabız kapanır.

## 7. Bileşen kataloğu (`src/design-system/components`)

| Bileşen | Varyantlar / Props | Not |
|---|---|---|
| `Button` | primary (mint), create (sarı), secondary (surface), ghost, destructive · sm/md/lg · loading · icon | Yükseklik 36/44/52, pill |
| `IconButton` | glass, surface, plain · 36/44 | Harita kontrolleri glass |
| `Chip` | default, selected, type(tipRengi) · ikon opsiyonel | Filtre ve tip seçimi |
| `TypeBadge` | tip + seviye metni, ör. "Bekleme · 5–15 dk" | Tip rengi %16 opak zemin + tip rengi metin |
| `LevelMeter` | 4 çubuk, dolu sayısı = seviye+1 | Renk seviye skalasından |
| `Avatar` | xs 24 · sm 32 · md 40 · lg 56 · xl 88 · story halkası (none / unseen / seen) · online nokta | Halka: unseen = mint→sarı gradyan, seen = ink600 |
| `FreshnessRing` | bkz. §6 | İmza öğe |
| `StatRow` | 2–4 öğe: ikon + değer + etiket (tek sefer) | "Taze tazelik" hatasının çözümü |
| `VerifyBar` | "Hâlâ böyle mi?" + [Evet · n] [Değişti · n] + son doğrulama zamanı | Kullanıcı oy verdiyse seçili gösterir |
| `ReactionBar` | ❤️ 🔥 😮 😂 🙏 hızlı seçim + toplam | Uzun basınca açılır, tek dokunuş = son kullanılan |
| `ActionRow` | tepki, yorum, paylaş, kaydet | Instagram düzeni, kaydet sağda |
| `MediaCarousel` | foto/video, 4:5 veya orijinal oran (min 4:5, maks 9:16), sayfa noktaları, blurhash | Dokununca görüntüleyici |
| `SignalCard` | compact (liste), feed (akış), modal (harita pop-up) | Tek bileşen, 3 yoğunluk |
| `CommentItem` | avatar, ad, metin (@bahsetme vurgulu), zaman, beğen, yanıtla, yanıtları gör | |
| `CommentInput` | avatar + input + gönder; üstte hızlı emoji satırı | Klavye ile yapışık |
| `UserRow` | avatar, ad, @kullanıcıadı, alt bilgi, sağda FollowButton | Listeler |
| `FollowButton` | Takip et (primary) / Takip ediliyor (secondary) / İstek gönderildi / Geri takip et | Optimistic |
| `PlaceRow` | kategori ikonu, ad, uzaklık, canlı durum rozeti | |
| `StoryTray` | yatay avatar listesi, ilk öğe "Hikayen" (+) | |
| `SegmentedControl` | 2–4 segment, kayan gösterge | |
| `ProfileTabs` | ikonlu sekmeler + kayan alt çizgi | |
| `Sheet` | bottom sheet, snap noktaları, tutamaç | @gorhom/bottom-sheet |
| `CenterModal` | Sinyal Kartı kabı: overlay + blur + spring giriş + aşağı kaydırarak kapatma | |
| `Toast` | success / error / info, üstten, 3 sn | "Paylaşıldı", "Kaydedildi" |
| `Skeleton` | satır, daire, kart, ızgara | Shimmer yok, sabit nabız (reduced motion'da sabit) |
| `EmptyState` | ikon, başlık, açıklama, eylem butonu | Boşluk = eyleme davet |
| `ErrorState` | ne oldu + nasıl düzelir + "Tekrar dene" | Özür dilemez, net söyler |
| `ChatBubble` | outgoing (mint zemin, koyu metin) / incoming (surface) · gruplama · okundu | |
| `SnapBubble` | gönderildi / açıldı / açılmadı · kırmızı=foto, mor=video | Snapchat dili |
| `SharedSignalBubble` | sohbette sinyal kartı önizlemesi | |
| `MapPin`, `ClusterPin`, `PlacePin`, `UserMarker` | bkz. `04` | |
| `HealthNotice` | sağlık kategorisi uyarı bandı | "Acil durumda 112" |

## 8. Hareket (motion) ve haptik
- Kütüphane: Reanimated 3. Varsayılan yay: `{ damping: 18, stiffness: 220, mass: 1 }`.
- Süreler: hızlı 150 ms (basma geri bildirimi), standart 250 ms (sayfa öğeleri), vurgu 350 ms (modal).
- **Sinyal Kartı açılışı:** pin konumundan kartın merkezine ölçek 0.85→1 + opaklık 0→1 (350 ms, yay);
  arka plan overlay 0→1 (250 ms). Kapanış tersine, pin konumuna doğru.
- **Kart → Gönderi detayı:** medya paylaşılan öğe geçişi (shared element) ile büyür.
- **Tepki:** seçilen emoji 1→1.4→1 zıplar, sayı yukarı kayarak değişir.
- **Doğrulama "Evet":** buton mint dolar, onay işareti çizilir, `+1` yukarı süzülür.
- **Basma geri bildirimi:** tüm dokunulabilir öğeler basılıyken scale 0.97.
- **Haptik:** seçim (`selection`) → çip/segment/filtre değişimi; hafif (`impactLight`) → tepki, takip,
  kaydet; başarı (`notificationSuccess`) → paylaşım tamamlandı, doğrulama; uyarı → hata.
- "Hareketi Azalt" açıksa: yay yerine 150 ms opaklık geçişi, nabız yok.

## 9. Yazım dili (UI metni)
- Kısa, aktif fiil, cümle düzeni. Buton ne yapacağını söyler: "Paylaş", "Takip et", "Kaydet".
- Aynı eylem akış boyunca aynı adı taşır: buton "Paylaş" → toast "Paylaşıldı".
- Boş durumlar eyleme çağırır: "Burada henüz sinyal yok. İlk sinyali sen bırak."
- Hatalar ne olduğunu ve çözümü söyler: "Fotoğraf yüklenemedi. Bağlantını kontrol edip tekrar dene."
- Mevcut terimler korunur: Sinyal, Sinyal bırak, Hâlâ böyle mi?, Canlı, Taze, Kaydet, Snap.
