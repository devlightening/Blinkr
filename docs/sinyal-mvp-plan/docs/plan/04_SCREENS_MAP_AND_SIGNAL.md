# 04 — Harita, Sinyal Kartı, Gönderi Detayı, Yorumlar, Yer Sayfası

## 1. Harita ekranı

### 1.1 Yerleşim
```
┌───────────────────────────────────────┐
│ [🔍 Nereye gidiyorsun?        ] (🔔)(◉)│  ← glass üst bar, safe-area altında
│ ◯Hikayen ◯gamze ◯baris ◯tolga ◯...    │  ← StoryTray (aktif hikaye varsa görünür)
│ [Tümü][Canlı][Doluluk][Bekleme][Trafik]→│  ← yatay filtre çipleri
│                                         │
│            (harita)                     │
│        ◉ pin      ◉                     │
│              (12) küme                  │
│      ●  ← kullanıcı konumu              │
│                                    [➤]  │  ← konumuma dön (glass IconButton)
│                                    [≡]  │  ← katman: Sinyaller / Yerler / Isı haritası
│ ╭─ Yakında: 3 canlı sinyal · 1,5 km ─╮  │  ← mini özet (dokununca Keşfet > Yakınımda)
│ ╰────────────────────────────────────╯  │
│   Harita  Keşfet   (+)   Sohbet  Profil │
└───────────────────────────────────────┘
```

### 1.2 Davranışlar
- **Veri yükleme:** Harita durduğunda (onRegionChangeComplete, 400 ms debounce) görünür bbox için
  `GET /v1/map/signals` ve `GET /v1/map/places` çağrılır. "Bu alanı tara" butonu kaldırılır; yalnızca
  kullanıcı çok uzağa kaydırıp istek limitine takılırsa "Bu alanda ara" görünür.
- **"0 görünür" rozeti kaldırılır.** Görünür alanda sinyal yoksa alttaki mini özet şuna döner:
  "Bu bölgede şu an canlı sinyal yok · İlk sinyali bırak" (dokununca kamera).
- **Filtre çipleri:** Tümü, Canlı (< 15 dk), tip çipleri (Doluluk, Bekleme, Geçici durum, Trafik,
  Etkinlik, Hava, Park, Gözlem), "Takip ettiklerim". Çoklu seçim; seçim MMKV'de saklanır.
- **Katmanlar menüsü (bottom sheet):** Sinyaller (varsayılan açık), Yerler (canlı durumu olan yerler),
  Isı haritası (zoom < 13'te yoğunluk). MVP'de ısı haritası opsiyonel; react-native-maps `Heatmap`
  yalnızca Google provider'da var — Apple Maps'te yoksa ertele ve DECISIONS.md'ye yaz.
- **Kullanıcı konumu:** Sistem mavi nokta. İzin yoksa üstte kalıcı olmayan bant: "Yakınındaki
  sinyalleri görmek için konum izni ver" + "İzin ver".
- **Harita stili:** Koyu temada koyu harita (Apple Maps `userInterfaceStyle="dark"`; Google provider'da
  özel JSON stil: POI etiketleri azaltılmış, yollar ink700, su ink850).
- **Arama:** Üst bara dokununca `search` ekranı açılır (Yerler | Kişiler sekmeleri). Yer seçilince
  harita oraya uçar ve yer sayfası açılır.

### 1.3 Pin tasarımı
```
 MapPin (tekil sinyal)            ClusterPin              PlacePin (yer özeti)
    ╭───╮                          ╭─────╮               ╭──────────────╮
   │ ⏱ │ ← tip ikonu, tip rengi     │ 12  │ ← sayı      │ ⚕ Kalabalık ▮▮▮│
    ╰─┬─╯   halka = FreshnessRing   ╰─────╯   zemin =    ╰──────┬───────╯
      ▼     alt küçük rozet:                 baskın tip        ▼
            medya varsa minik kamera         renginde
            arkadaşsa minik avatar
```
- **MapPin boyutu:** 40pt daire (seçiliyken 52pt, yay animasyonu). Canlı (< 15 dk) ise halka nabzı.
- **Yaşlanma:** Ömrünün %70'ini tamamlamış sinyal pinleri %60 opaklığa iner.
- **Takip edilen kullanıcı / arkadaş sinyali:** Pin içinde tip ikonu yerine kullanıcının avatarı, alt
  köşede küçük tip ikonu.
- **Anonim sinyal:** Avatar gösterilmez, her zaman tip ikonu.
- **Kümeleme:** `supercluster` (radius 60, maxZoom 16). Küme rengi = kümedeki baskın tip. Kümeye
  dokunma: zoom 16'dan küçükse yakınlaştır; 16+ ise (aynı nokta) **Sinyal Kartı'nı kümedeki
  sinyallerle aç** (yatay kaydırarak gezilir).
- **Yer pini:** Canlı durumu olan yerler için kapsül: kategori ikonu + durum etiketi + LevelMeter.
  Yer pinine dokunma → Sinyal Kartı o yerin sinyalleriyle açılır, kart üstünde yer özeti şeridi olur.
- **Performans:** Pin görünümleri memoize, `tracksViewChanges={false}` (görsel yüklenince bir kez true
  → false), görünür alan dışındaki pinler render edilmez, maksimum 300 pin; fazlası kümelenir.

## 2. Sinyal Kartı (merkez pop-up) — ana yenilik

### 2.1 Yerleşim
```
          (harita karartılmış + blur; seçili pin kartın üstünde parlıyor)
   ┌─────────────────────────────────────────┐
   │ (◉) ahmet  ✓Konumda                 ⋯  │  ← Avatar+FreshnessRing, ad, doğrulama rozeti, menü
   │      2 dk önce · 1 sa 28 dk kaldı       │
   │ ┌─────────────────────────────────────┐ │
   │ │                                     │ │
   │ │         MEDYA (4:5, kırpmasız)      │ │  ← MediaCarousel, dokun = tam ekran
   │ │                                     │ │
   │ │ [⏱ Bekleme · 5–15 dk]       ● ○ ○  │ │  ← TypeBadge medya üstünde (sol alt)
   │ └─────────────────────────────────────┘ │
   │ ⚕ Özel Yeni Hayat Hastanesi   283 m  › │  ← yer satırı (dokun = yer sayfası)
   │ Acile gelmeyin, çok kalabalık.          │  ← açıklama (maks 3 satır, "devamı")
   │ ┌ ⚠ Acil durumda 112'yi ara. ──────────┐│  ← HealthNotice (yalnızca sağlık yerleri)
   │ ├─────────────────────────────────────┤ │
   │ │ Hâlâ böyle mi?                      │ │  ← VerifyBar
   │ │ [✓ Evet · 12]  [↻ Değişti · 2]      │ │
   │ │ Son doğrulama 3 dk önce             │ │
   │ ├─────────────────────────────────────┤ │
   │ │ ♡ 24   💬 8   ↗          🔖         │ │  ← ActionRow
   │ │ ayse_k aynen, 1 saattir sıradayım   │ │  ← en iyi 1 yorum önizleme
   │ │ 8 yorumun tümünü gör                │ │
   │ │ (◉) Yorum ekle…                     │ │  ← dokununca detay + klavye açık
   │ └─────────────────────────────────────┘ │
   └─────────────────────────────────────────┘
                 ‹  1 / 3  ›                     ← aynı yer/kümede birden çok sinyal varsa
```
- **Boyut:** Genişlik = ekran − 2×16; yükseklik içeriğe göre, maks ekranın %82'si (fazlası kart içinde
  kaydırılır). Köşe `xl 28`, zemin `bg.surfaceRaised`.
- **Medya yoksa (sadece metin sinyali):** Medya alanı yerine tip renginde yumuşak gradyan zeminli
  "metin kartı": büyük tip ikonu + seviye etiketi (`title1`, Bricolage) + açıklama.
- **Medya oranı:** Orijinal oran korunur; 4:5'ten daha yataysa 4:5 kapsayıcıda `contain` ve blurhash
  arka plan; 9:16'dan daha dikse 9:16'ya sınırlanır. **Yüz/ana içerik asla kırpılmaz** (mevcut hata #2).
- **Video:** Sessiz otomatik oynatma, döngü, sağ altta ses butonu.

### 2.2 Etkileşimler
| Hareket | Sonuç |
|---|---|
| Yatay kaydırma (kart üzerinde) | Aynı yer/kümedeki önceki/sonraki sinyal (FlashList yatay, sayfalı) |
| Medya içinde yatay kaydırma | Aynı sinyalin diğer medyası (medya carousel önceliklidir; carousel sonunda kart geçer) |
| Aşağı kaydırma / overlay'e dokunma | Kart kapanır (pin konumuna doğru küçülerek) |
| Medyaya dokunma | Tam ekran medya görüntüleyici |
| Medyaya çift dokunma | ❤️ tepkisi (Instagram) + kalp animasyonu |
| Yazar adı / avatar | Kullanıcı profili (anonimse devre dışı) |
| Yer satırı | Yer sayfası |
| "Evet" | Doğrulama gönderilir (optimistic), buton seçili, haptik başarı. Tekrar dokunma = geri al |
| "Değişti" | Alt sayfa: yeni seviye seçimi (+ opsiyonel foto) → yeni sinyal olarak kaydedilir ve eskisine bağlanır |
| ♡ kısa dokunma | ❤️ tepkisi aç/kapa · uzun basma: ReactionBar (❤️ 🔥 😮 😂 🙏) |
| 💬 / "yorumların tümünü gör" / "Yorum ekle" | Gönderi detayı (yorum ekle ise klavye açık) |
| ↗ | Paylaş sayfası: Sohbete gönder (arkadaş listesi), Bağlantıyı kopyala, Sistem paylaşımı |
| 🔖 | Kaydet (kısa) · uzun basma: koleksiyon seç |
| ⋯ | Menü: Bildir, Bu kullanıcıyı sessize al, Engelle · (kendi sinyalinse) Düzenle, Haritadan kaldır, Sil |

- **Doğrulama kuralları:** Kullanıcı yalnızca sinyalin konumuna ≤ 500 m uzaktaysa "Evet/Değişti"
  kullanabilir. Uzaktaysa butonlar pasif ve altında "Doğrulamak için bu yere yakın olmalısın" yazar.
  Kendi sinyalini doğrulayamaz. (Kurallar `10_SIGNAL_ENGINE.md`.)
- **Görüntülenme:** Kart ≥ 1 sn görünür kalınca görüntülenme kaydedilir (toplu gönderim, 10 sn'de bir).
- **Canlı güncelleme:** Kart açıkken `signal:{id}` odasına abone olunur; yeni tepki/yorum/doğrulama
  sayıları anlık güncellenir.

## 3. Gönderi detayı (`signal/[id]`)
```
┌───────────────────────────────────────┐
│ ←   Sinyal                         ⋯  │
│ (◉) ahmet ✓Konumda · 2 dk   [Takip et]│
│ ┌───────────────────────────────────┐ │
│ │            MEDYA (tam genişlik)   │ │
│ └───────────────────────────────────┘ │
│ ♡ 24  💬 8  ↗                     🔖  │
│ 24 kişi tepki verdi  (❤️🔥🙏)          │
│ [⏱ Bekleme · 5–15 dk] ⚕ Özel Yeni Hayat Hastanesi ›
│ Acile gelmeyin, çok kalabalık.        │
│ VerifyBar                              │
│ StatRow: 👁 312 görüntülenme · ✓ 12 doğrulama · 🛡 Güven: Orta │
│ ───────── Yorumlar (8) ── [En yeni ▾] │
│ (◉) ayse_k aynen, 1 saattir sıradayım  ♡│
│     3 dk · Yanıtla · 4 beğeni          │
│     ── 2 yanıtı gör                    │
│ (◉) mehmet @ahmet teşekkürler 🙏       ♡│
│ ...                                    │
│ ─────────────────────────────────────  │
│ ❤️ 🙏 😮 😂 🔥 👏                        │  ← hızlı emoji satırı
│ (◉) Yorum ekle…                 [Gönder]│  ← klavyeye yapışık
└───────────────────────────────────────┘
```
- **Yorumlar:** Cursor sayfalama (20'şer). Sıralama: "Öne çıkanlar" (beğeni + yazar yanıtı + takip
  edilen) / "En yeni". Tek seviye yanıt (yanıta yanıt, üst yoruma @bahsetme ile eklenir).
- **@bahsetme:** `@` yazınca kullanıcı arama önerileri (önce takip edilenler). Bahsedilen kullanıcıya
  bildirim gider. Metinde bahsetmeler `accent.primary` renkli ve dokunulabilir.
- **Yorum eylemleri:** Beğen (çift dokunma da), Yanıtla, uzun basma menüsü: Kopyala, Bildir,
  (kendi yorumunsa) Sil, (sinyal sahibiysen) Yorumu sil / kullanıcıyı kısıtla.
- **Yazar yanıtı rozeti:** Sinyal sahibinin yorumlarında adının yanında küçük "Paylaşan" etiketi.
- **Yorum kapatma:** Sinyal sahibi ⋯ menüsünden yorumları kapatabilir.
- **Moderasyon:** Gönderilen yorum sunucuda filtrelenir; engellenirse "Yorumun topluluk kurallarına
  uymadığı için paylaşılamadı." hatası.

## 4. Tam ekran medya görüntüleyici (`signal/[id]/media`)
- Siyah zemin, pinch-zoom (maks 4×), çift dokunma zoom, yatay kaydırma medyalar arası.
- Aşağı/yukarı kaydırma ile kapanır (opaklık kaydırma mesafesine bağlı).
- Üstte: yazar + zaman + kapat (✕). Altta: ActionRow (tepki, yorum, paylaş, kaydet).
- Video: oynat/duraklat, ilerleme çubuğu, ses.
- Kaydetme (cihaza indirme) yalnızca kendi medyası için; başkasınınki için yok (gizlilik).

## 5. Yer sayfası (`place/[id]`)
```
┌───────────────────────────────────────┐
│ ←                             ↗   🔖  │
│ ⚕  Özel Yeni Hayat Hastanesi          │  title1
│    Sağlık · Raufbey Mh. · 283 m       │
│ ┌ CANLI DURUM ───────────────────────┐│
│ │ ⏱ Bekleme  5–15 dk        ▮▮▯▯    ││  ← büyük durum, LevelMeter
│ │ Güven: Orta · 3 sinyal · 12 doğrulama ││
│ │ Son güncelleme 3 dk önce            ││
│ └────────────────────────────────────┘│
│ ⚠ Acil durumda 112'yi ara…  (sağlıkta)│
│ [🔔 Takip et]  [➤ Yol tarifi]  [? Soru sor] │
│ VerifyBar (yerin mevcut durumu için)   │
│ ── Son sinyaller ─────── [Izgara|Liste]│
│ ▦ ▦ ▦                                  │  ← 3 sütun ızgara, TypeBadge köşede
│ ▦ ▦ ▦                                  │
│ ── Geçmiş (sona erenler, soluk) ──     │
└───────────────────────────────────────┘
```
- **Canlı durum** `10_SIGNAL_ENGINE.md`'deki algoritmayla backend'de hesaplanır. Aktif sinyal yoksa:
  "Şu an canlı bilgi yok" + "Soru sor" ve "Sinyal bırak" butonları.
- **Takip et:** Bildirim tercihi sayfası: "Tüm yeni sinyaller" / "Yalnızca durum değişince".
- **Soru sor:** Kısa metin ("Şu an sıra var mı?") → yer sayfasında soru kartı olarak görünür ve yerin
  500 m yakınındaki, bildirim izni olan ve son 7 günde aktif kullanıcılara (maks 30 kişi, kişi başı
  günde maks 3 soru bildirimi) push gider. Yanıt = yeni sinyal (soruya bağlı).
- **Yol tarifi:** Apple Maps / Google Maps seçimi (sistem varsayılanı).
- **Kategori listesi** (`places.category`): Sağlık, Market, Banka, Kamu, Ulaşım, Kafe/Restoran, Park,
  İbadet, Eğitim, Alışveriş, Eğlence, Spor, Diğer. Sağlık kategorisinde HealthNotice zorunlu.

## 6. Mevcut ekranlardan geçiş
- Mevcut alttan açılan "yer detayı" sayfası kaldırılmaz; **yer sayfasının** tam hali olarak yeniden
  kullanılır. Pin dokunuşu artık Sinyal Kartı'nı açar; yer sayfasına kart içindeki yer satırından gidilir.
- "Son sinyaller" listesindeki kartlar `SignalCard compact` bileşenine geçer; tekrarlayan başlık/etiket
  sorunu (#4) burada çözülür: başlık alanı kaldırılır, açıklama yoksa sadece TypeBadge + yer + zaman.
