# 05 — Oluşturma (Kamera), Keşfet Akışı, Hikayeler

## 1. Oluşturma akışı (Snapchat tarzı)

Hedef: (+) dokunuşundan paylaşıma **en az 3 dokunuş** (çek → tip seç → gönder). Tüm akış tam ekran
modal; her adımda sol üstte geri/kapat.

### 1.1 Kamera (`create/camera`)
```
┌───────────────────────────────────────┐
│ ✕                       ⚡  🌙  ⟳     │  ← kapat · flaş · gece modu · kamera çevir
│                                        │
│          CANLI KAMERA ÖNİZLEMESİ        │
│                                        │
│  📍 Özel Yeni Hayat Hastanesi ▾        │  ← algılanan yer (dokun = değiştir)
│                                        │
│   [▢]        (  ◯  )         [Aa]      │  ← galeri · deklanşör · sadece metin
│          FOTO  ·  VİDEO                │
└───────────────────────────────────────┘
```
- **Anında açılış:** Kamera izni varsa (+) dokunuşunda < 500 ms'de önizleme. Önceki "Ne paylaşmak
  istersin?" seçim sayfası kaldırılır; seçenekleri kamera ekranındaki öğeler karşılar:
  Kamera = deklanşör, Galeri = sol alt küçük resim, Sadece sinyal = "Aa", Snap gönder = gönder
  ekranında arkadaş seçmek.
- **Deklanşör:** Dokun = foto. Basılı tut = video (maks 15 sn, halka ilerlemesi). Basılıyken yukarı
  kaydır = zoom.
- **Yer algılama:** Kamera açılırken konum alınır (yüksek doğruluk, 5 sn zaman aşımı) ve
  `GET /v1/places/nearby` ile en yakın yer önerilir. Doğruluk > 100 m ise "Konum belirsiz" uyarısı.
- **Galeri:** Seçilen medyanın EXIF tarih/konumu okunur (yalnızca doğrulama için, sunucuya EXIF'siz
  gider). 2 saatten eski medya "Canlı" olamaz: sinyal "Galeriden" etiketi alır ve güven ağırlığı düşer.
- **İzin yoksa:** Tam ekran izin açıklaması + "Kameraya izin ver" (sistem ayarlarına yönlendirir).

### 1.2 Düzenleme (`create/edit`)
```
┌───────────────────────────────────────┐
│ ←                       T   ☺   ✎     │  ← metin · çıkartma · çizim (V1.1)
│                                        │
│     ÇEKİLEN FOTO (filtre uygulanmış)    │
│        [Kalabalık]  ← sürüklenebilir    │
│                  [14:20]                │
│                                        │
│         ‹ Retro ›  ← filtre adı kısa gösterilir
│                          [İleri →]      │
└───────────────────────────────────────┘
```
- **Filtreler:** Foto üzerinde yatay kaydırma ile değişir (Snapchat). Mevcut filtreler korunur:
  Normal, Gün batımı, Nane, Neon, Buz, Retro, Sinema, Gece. Skia ile GPU'da uygulanır; değişimde
  filtre adı 1 sn ortada görünür. Haptik `selection`.
- **Çıkartmalar (☺ → alt sayfa):**
  - Bağlam: Saat (14:20), Yer adı, Sıcaklık (V1.1), Tip çıkartmaları (Kalabalık, Sıra var, Sakin,
    Etkinlik, Yol çalışması, Güzel hava, Kapalı, Park yok).
  - Emoji arama.
  - Her çıkartma: sürükle, iki parmakla ölçekle/döndür, ekranın altındaki çöpe sürükleyince silinir.
    Yeni eklenen çıkartma mevcutlarla çakışmayacak boş alana yerleşir (mevcut hata #8).
  - Tip çıkartması eklenirse Detaylar adımında o tip otomatik seçilir.
- **Metin (T):** Dokun → klavye; 3 stil (düz, zeminli, vurgulu), renk seçimi, sürüklenebilir.
- **Çıktı:** Filtre + çıkartma + metin nihai görsele gömülür (flatten) ve ayrıca çıkartma metadatası
  JSON olarak gönderilir (analitik ve ileride düzenleme için).

### 1.3 Detaylar (`create/details`) — sinyali anlamlı kılan adım
```
┌───────────────────────────────────────┐
│ ←  Sinyal detayları                    │
│ [küçük önizleme]                       │
│ Ne oluyor?                             │
│ [👥Doluluk][⏱Bekleme][⚠Durum][🚗Trafik] │  ← büyük tip çipleri (2 satır)
│ [🎉Etkinlik][⛅Hava][🅿Park][👁Gözlem]    │
│ Ne kadar?                              │
│ [Sakin][Hareketli][Kalabalık][Çok]     │  ← seçilen tipe göre seviye segmenti
│ Nerede?                                │
│ ⚕ Özel Yeni Hayat Hastanesi · 40 m  ✓ │  ← en yakın 5 yer + "Yer yok (sadece konum)"
│ Açıklama (opsiyonel)                   │
│ [Acile gelmeyin, çok kalabalık… 0/280] │
│ Görünürlük: [Herkes ▾]  Anonim [○]     │
│ Haritada 1 sa 30 dk kalır              │  ← tipin TTL'i (bilgi)
│                     [İleri →]          │
└───────────────────────────────────────┘
```
- **Tip zorunlu**, seviye tip seviyeli ise zorunlu. Seviyeler `10_SIGNAL_ENGINE.md` tablosunda.
- **Yer:** Kullanıcıya en yakın 5 yer, uzaklıkla. Yer yarıçapı içindeyse ✓ (konum doğrulandı).
  "Yer yok" seçilirse sinyal sadece koordinata bağlanır (bulanıklaştırılmış gösterilir).
- **Görünürlük:** Herkes (haritada herkese açık) · Takipçiler · Yakın arkadaşlar (V1.1) · Yalnızca ben
  (arşiv). "Herkes" dışındakiler haritada yalnızca o kitleye görünür.
- **Anonim:** Açıksa haritada ve akışta yazar gösterilmez; profilde yalnızca sahibine görünür ("Anonim"
  etiketiyle). Anonim sinyal hikayeye gönderilemez. Anonim sinyaller güven hesabında sahibine yine
  yazılır (kötüye kullanım önlemi).
- **Açıklama:** 280 karakter, @bahsetme ve #etiket desteği (etiket V1.1'de aranabilir).
- **Sadece metin modunda** önizleme yerine tip renginde metin kartı önizlemesi gösterilir.

### 1.4 Gönder (`create/send`)
```
┌───────────────────────────────────────┐
│ ←  Gönder                              │
│ [✓] 🗺 Haritaya paylaş (Herkes)         │
│ [✓] ◯  Hikayem (24 sa)                 │
│ ── Arkadaşlar (snap olarak) ──  🔍     │
│ [ ] (◉) gamze_tekin                    │
│ [ ] (◉) baris_cakir                    │
│ ...                                    │
│                  [ Gönder  ➤ ]  (sarı)  │
└───────────────────────────────────────┘
```
- Harita ve Hikayem varsayılan seçili (anonimse Hikayem devre dışı).
- Arkadaş seçilirse aynı medya her birine **snap** (bir kez izlenir) olarak gider.
- Sadece arkadaş seçilip Harita kapatılırsa bu bir sinyal değil, sadece snap'tir (tip/yer opsiyonel).
- **Yükleme:** Gönder'e basınca modal hemen kapanır; yükleme arka planda sürer. Harita/profilde
  "Paylaşılıyor…" ilerleme çipi görünür. Başarılı → toast "Paylaşıldı" + haptik başarı + pin nabız.
  Başarısız → toast "Paylaşılamadı · Tekrar dene"; taslak cihazda kalır (bkz. 1.5).

### 1.5 Çevrimdışı ve taslak
- Gönderim kuyruğu MMKV'de saklanır; bağlantı gelince otomatik yeniden dener (üstel geri çekilme,
  maks 5 deneme). Sinyalin `captured_at` zamanı korunur; 30 dk'dan geç ulaşan sinyal "Gecikmeli"
  işaretlenir ve TTL'i `captured_at`'e göre hesaplanır.
- Uygulama kapanırsa taslak saklanır; bir sonraki açılışta "Paylaşılmamış 1 sinyalin var" toast'ı.

## 2. Keşfet (`explore`) — eski "Yakında" ekranının yerini alır

### 2.1 Yerleşim
```
┌───────────────────────────────────────┐
│ Keşfet                      🔍   🔔(3) │
│ ◯Hikayen ◯gamze ◯baris ◯tolga …        │  ← StoryTray
│ [ Yakınımda | Takip ]                  │  ← SegmentedControl
│ [Tümü][Canlı][Doluluk][Bekleme]…  1,5 km ▾│  ← filtre + yarıçap (0,5/1,5/5/15 km)
│ ┌ YER DURUMU ───────────────────────┐  │
│ │ ⚕ Özel Yeni Hayat Hast. Bekleme 5–15 dk ▮▮▯▯ 3 dk │ ← yatay kaydırılan yer kartları
│ └────────────────────────────────────┘ │
│ ┌ SignalCard (feed) ──────────────────┐│
│ │ (◉) ahmet ✓ · 2 dk · 283 m      ⋯  ││
│ │ [MEDYA 4:5]                         ││
│ │ ♡ 24 💬 8 ↗                   🔖    ││
│ │ [⏱ Bekleme · 5–15 dk] ⚕ Özel Yeni…  ││
│ │ Acile gelmeyin, çok kalabalık.      ││
│ │ ✓ 12 kişi doğruladı · Hâlâ böyle mi?││
│ └─────────────────────────────────────┘│
│ …                                       │
└───────────────────────────────────────┘
```
- **Yakınımda:** `GET /v1/feed/nearby` — sıralama `10_SIGNAL_ENGINE.md` §7. Üstte "Yer durumu"
  yatay şeridi: yarıçaptaki canlı durumu olan yerler.
- **Takip:** `GET /v1/feed/following` — takip edilenlerin ve takip edilen yerlerin sinyalleri, ters
  kronolojik; aktif olanlar önce, sona erenler "Sona erdi" rozetiyle soluk.
- **Boş durumlar:** Yakınımda boş → "1,5 km içinde canlı sinyal yok. Yarıçapı genişlet ya da ilk
  sinyali bırak." Takip boş → "Henüz kimseyi takip etmiyorsun" + önerilen kişiler listesi.
- **Önerilen kişiler kartı:** Akışta her ~15 gönderide bir: yakındaki aktif katkıcılar, ortak takip.
- Kart üzerindeki etkileşimler Sinyal Kartı ile aynı (çift dokunma ❤️, yorum → detay, vs.).
- **Çekerek yenile**, sonsuz kaydırma (cursor), üst sekmeye tekrar dokunma = başa kaydır.
- **Bildirim zili** (sağ üst): `notifications` ekranı, okunmamış sayısı rozeti.

## 3. Hikayeler

### 3.1 Model
- Hikaye = kullanıcının son 24 saatte "Hikayem"e gönderdiği sinyaller (+ yalnızca hikaye olarak
  paylaşılan medya). Harita TTL'inden bağımsız olarak 24 saat hikayede kalır.
- **Kim görür:** Hesap açıksa takipçiler (Keşfet/Harita şeridinde) + profil ziyaretçileri (avatar
  halkası); hesap gizliyse yalnızca onaylı takipçiler.
- **Şerit sırası:** Görülmemiş hikayesi olanlar önce; içlerinde etkileşim yakınlığı (DM, tepki
  sıklığı) + yenilik. İlk öğe her zaman "Hikayen" (yoksa + ile kamera).

### 3.2 Hikaye görüntüleyici (`stories/[userId]`)
```
┌───────────────────────────────────────┐
│ ▬▬▬▬ ▬▬▬▬ ▭▭▭▭                        │  ← ilerleme çubukları (her öğe 6 sn, video kendi süresi)
│ (◉) gamze_tekin · 2 sa   📍 Kent Meydanı  ✕ │
│                                        │
│            TAM EKRAN MEDYA              │
│                                        │
│ [👥 Doluluk · Kalabalık]                │
│ Hava güzel, herkes dışarıda             │
│                                        │
│ ( Yanıt gönder…            ) ♡  ↗      │
└───────────────────────────────────────┘
```
- Sağa dokun = sonraki, sola = önceki, basılı tut = duraklat (arayüz gizlenir), aşağı kaydır = kapat,
  yukarı kaydır = gönderi detayı (yorumlar), yatay kaydırma = sonraki kullanıcının hikayesi (küp geçiş).
- "Yanıt gönder" → DM'e hikaye önizlemesiyle birlikte mesaj.
- Kendi hikayende: altta "👁 42" görüntüleyenler listesi (alt sayfa), ⋯ menüsünde "Hikayeden kaldır".
- Görüldü bilgisi `POST /v1/stories/seen` ile toplu gönderilir.
- Medya önceden yüklenir (sonraki 2 öğe).
