# 10 — Sinyal Motoru (İş Mantığı)

Bu dosyadaki tüm kurallar backend'de `modules/signals/engine/` altında saf fonksiyonlar olarak yazılır
ve **birim testlidir**. Sabitler tek dosyada (`engine/config.ts`) tutulur ki sonradan ayarlanabilsin.

## 1. Tip kataloğu

| Tip | TR / EN | Seviyeler (0→3) | TTL (harita) | Konum doğrulama yarıçapı |
|---|---|---|---|---|
| `crowd` | Doluluk / Crowd | Sakin · Hareketli · Kalabalık · Çok kalabalık | 90 dk | yer yarıçapı (vars. 120 m) |
| `wait` | Bekleme / Wait | 5 dk'dan az · 5–15 dk · 15–30 dk · 30 dk+ | 60 dk | yer yarıçapı |
| `status` | Geçici durum / Status | seviye yok; `statusValue`: Açık · Kapalı · Stok yok · Arızalı · Tadilat | 4 sa | yer yarıçapı |
| `traffic` | Trafik & yol / Traffic | Akıcı · Yavaş · Yoğun · Kilit (+ alt etiket: Kaza, Yol çalışması, Kapalı yol) | 60 dk (yol çalışması 6 sa) | 300 m |
| `event` | Etkinlik / Event | seviye yok | 3 sa | 300 m |
| `weather` | Hava / Weather | seviye yok; `statusValue`: Güneşli · Yağmurlu · Karlı · Rüzgârlı · Sisli | 2 sa | 1 km |
| `parking` | Park yeri / Parking | Bol · Az · Çok az · Yok | 45 dk | 200 m |
| `observation` | Gözlem / Observation | seviye yok | 2 sa | 300 m |

- Seviye metinleri i18n'de: `signal.level.crowd.0` vb.
- **Uzatma:** Sinyal "Evet, hâlâ böyle" doğrulaması aldıkça `expires_at` uzar:
  `expires_at = max(expires_at, verified_at + TTL × 0.5)`, toplam ömür en fazla `TTL × 3`.
- **Değişti:** `changed` doğrulaması yeni seviye içerirse, doğrulayan kişi adına **yeni bir sinyal**
  (medyasız, `source='text'`, `replaces_signal_id`) oluşturulur; eski sinyalin ömrü `min(kalan, 10 dk)`'ya iner.
- **Hikaye ömrü:** `in_story` ise `story_expires_at = created_at + 24 sa` (harita TTL'inden bağımsız).
- **Arşiv:** Süresi dolan sinyal `expired` olur; haritadan ve Yakınımda akışından düşer, profilde ve
  yer geçmişinde soluk kalır. Kullanıcı ayarı "süresi bitince sil" ise 7 gün sonra silinir.

## 2. Konum doğrulama (`location_verified`)
```
verified = source == 'camera' || source == 'text'
        && accuracyM <= 100
        && (place == null || distance(location, place.location) <= place.radius_m + accuracyM)
        && abs(now - capturedAt) <= 10 dk
Galeri: source == 'gallery' → verified = false; capturedAt (EXIF) 2 saatten eskiyse sinyal
        oluşturulabilir ama 'is_delayed' = true ve "Galeriden" etiketi alır.
is_delayed = (serverReceivedAt - capturedAt) > 30 dk
TTL başlangıcı = capturedAt (gecikmeli sinyal kısa yaşar; TTL'i dolmuşsa 'expired' oluşur → yalnızca profilde)
```
- **Sahte konum sezgileri (işaretler, tek başına engellemez):** Aynı kullanıcının ardışık iki
  sinyali arasındaki hız > 250 km/sa; accuracy tam 0 veya sürekli aynı; iOS `isFromMockProvider`
  karşılığı / Android mock location bayrağı. İşaretli sinyallerin güven ağırlığı ×0.3.

## 3. Konum bulanıklaştırma (`display_location`)
Profil ekranındaki söz ("Kesin cihaz konumun diğer kullanıcılara gösterilmez") teknik olarak garanti edilir.
```
if place != null:              display_location = place.location          (yer merkezi)
else if type in (traffic, weather, event): display_location = snap to ~75 m ızgara (H3 res 10 merkezi veya ST_SnapToGrid)
else:                          display_location = snap to ~150 m ızgara + deterministik ofset (hash(signal_id) ile ±40 m)
```
- `location` (gerçek) hiçbir API yanıtında, logda veya analitik olayında yer almaz.
- Mesafe (`distanceM`) istemciye `display_location` üzerinden, 10 m'ye yuvarlanarak döner.
- Kullanıcının **ev** gibi tekrarlayan konumlarından atılan yer'siz sinyaller (aynı 150 m hücresinde
  son 14 günde ≥ 5 yer'siz sinyal) için ek bulanıklaştırma: 500 m ızgara. (Takip edilebilirlik riskini azaltır.)

## 4. Doğrulama kuralları ("Hâlâ böyle mi?")
- Doğrulayan, sinyalin `display_location`'ına ≤ **500 m** (istek anındaki konum, accuracy ≤ 150 m).
  Aksi halde `403 TOO_FAR`. Sunucu `distance_m`'i saklar.
- Kendi sinyalini doğrulayamaz. Sinyal başına kullanıcı başına tek doğrulama (değiştirilebilir, geri alınabilir).
- Süresi dolmuş sinyal doğrulanamaz (yerin güncel durumu için yer sayfasındaki VerifyBar kullanılır:
  bu, yerin baskın aktif sinyaline doğrulama gönderir; aktif sinyal yoksa "Sinyal bırak"a yönlendirir).
- Günlük limit: 100 doğrulama. Aynı yazara 24 saatte en fazla 10 doğrulama (kartel önlemi).

## 5. Yer canlı durumu (place live status) algoritması
Her yer ve tip için (yalnızca seviyeli tiplerde ağırlıklı ortalama; `status/weather` için ağırlıklı çoğunluk):
```ts
const HALF_LIFE_MIN = { crowd: 30, wait: 20, parking: 15, traffic: 20, status: 90, weather: 45, event: 60, observation: 45 };

function weight(s: Obs, now: Date): number {
  const ageMin = (now - s.observedAt) / 60000;
  const decay = Math.pow(0.5, ageMin / HALF_LIFE_MIN[s.type]);
  const trust = 0.4 + 0.6 * (s.authorTrust / 100);          // 0.4..1.0
  const loc = s.locationVerified ? 1.0 : 0.5;
  const media = s.hasMedia ? 1.1 : 1.0;
  const mock = s.flaggedMock ? 0.3 : 1.0;
  return decay * trust * loc * media * mock;
}
// Gözlemler (Obs) = aktif sinyaller + her 'still_true' doğrulama (sinyalin seviyesiyle, doğrulama zamanıyla)
//                  + her 'changed' doğrulama (newLevel ile)
function aggregate(obs: Obs[], now: Date) {
  const ws = obs.map(o => ({ o, w: weight(o, now) })).filter(x => x.w > 0.05);
  if (!ws.length) return null;                                   // canlı durum yok
  const W = sum(ws.map(x => x.w));
  const mean = sum(ws.map(x => x.w * x.o.level)) / W;
  const level = Math.round(mean);                                // 0..3
  const variance = sum(ws.map(x => x.w * (x.o.level - mean) ** 2)) / W;
  const agreement = 1 - Math.min(variance / 2.25, 1);            // 0..1 (maks varyans 2.25)
  const evidence = 1 - Math.exp(-W / 1.5);                       // 0..1, ağırlık arttıkça doyar
  const score = evidence * (0.5 + 0.5 * agreement);
  const confidence = score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low';
  const lastAt = max(obs.map(o => o.observedAt));
  const ageMin = (now - lastAt) / 60000;
  const freshness = ageMin < 15 ? 'live' : ageMin < 45 ? 'recent' : 'stale';
  return { level, confidence, freshness, activeSignals, verifications, lastSignalAt, lastVerifiedAt };
}
```
- Sonuç `place_live_status`'a yazılır. **Seviye değiştiyse** (ör. 3→1) `place_follows` modu `changes`
  olanlara bildirim: "Özel Yeni Hayat Hastanesi: bekleme 30 dk+ → 5–15 dk". Aynı yer için bildirimler
  en az 20 dk aralıklı.
- UI eşlemesi: `confidence` → "Yüksek güven / Orta güven / Düşük güven"; `freshness` → "Canlı / Güncel / Eski".
  (Mevcut "Taze tazelik / Orta güven güven" yerine StatRow: `⚡ Canlı · 🛡 Orta güven · 📍 283 m`.)

## 6. Güven puanı (kullanıcı, 0–100)
Bayesçi, manipülasyona dirençli:
```
pos = Σ (başkalarından gelen still_true doğrulamalar, doğrulayanın güveniyle ağırlıklı, doğrulayan başına yazara günlük maks 1)
      + 0.5 × thanks_received(son 90 gün)
neg = Σ (changed doğrulamalar — sinyal oluşturulduktan sonraki ilk 10 dk içinde gelenler, yani "yanlıştı" sinyali)
      + 3 × onaylanmış rapor (moderasyonun 'actioned' dediği)
α = 5, β = 5   (yeni kullanıcı ~50'den başlar)
raw = (pos + α) / (pos + neg + α + β)
age_factor = min(1, hesap_gün / 30) → yeni hesap üst sınırı: 50 + 30 × age_factor
trust = round(100 × raw) sınırlı [5, 50 + 50 × age_factor]
```
- Gece toplu + olay bazlı (debounce 5 dk) yeniden hesaplanır.
- Kullanıcıya gösterim: sayı + seviye adı. Düşük güvenli (< 25) kullanıcıların sinyalleri haritada
  gösterilir ama canlı durum hesabında ağırlığı düşüktür (formül zaten bunu yapar).

## 7. Akış sıralaması
### Yakınımda (`/feed/nearby`)
```
score = 0.35 × freshness + 0.25 × proximity + 0.20 × engagement + 0.10 × trust + 0.10 × social
freshness  = 1 - lifeProgress
proximity  = exp(-distance_km / (radiusKm / 2))
engagement = min(1, log1p(reactions + 2×comments + 3×verifyYes + 2×thanks) / log1p(50))
trust      = authorTrust / 100
social     = takip ediliyorsa 1, arkadaşsa 1, ortak takip varsa 0.5, yoksa 0
```
- Yalnızca `active`. Çeşitlilik: aynı yazardan art arda en fazla 1, aynı yerden art arda en fazla 2.
- Sessize alınan/engellenen yazarlar hariç. Cursor = (score, id) — sayfa başına 20.
- MVP'de bu hesap SQL'de (CTE) yapılır; ölçekte önceden hesaplanmış skor tablosuna geçilir.

### Takip (`/feed/following`)
Takip edilen kullanıcıların + takip edilen yerlerin sinyalleri, `created_at DESC`; aktifler, aynı
saat diliminde sona erenlerin önüne alınır.

## 8. Oyunlaştırma (gamification)
- **XP:** sinyal paylaş +5 (günde ilk 10 sinyal), aldığın her doğrulama +2, verdiğin doğrulama +1
  (günde ilk 20), "Teşekkürler" tepkisi +3, ilk sinyal bonus +20. Silinen/gizlenen sinyalin XP'si geri alınır.
- **Seviye eşikleri:** 1 Çaylak 0 · 2 Gözcü 100 · 3 Rehber 400 · 4 Usta Rehber 1200 · 5 Şehir Elçisi 3000.
- **Seri (streak):** Gün içinde (kullanıcının saat dilimine göre) ≥ 1 sinyal veya ≥ 3 doğrulama.
  Seri bozulmadan 1 gün önce 20:00'de hatırlatma bildirimi (kullanıcı kapatabilir).
- **Rozetler:** `06` §1.1 listesi; kriterler `badges.criteria` JSON'da.

## 9. Kötüye kullanım önleme
- Rate limit'ler: `07_BACKEND_ARCHITECTURE.md` §8.
- **Kopya sinyal:** Aynı kullanıcı, aynı yer, aynı tip, 30 dk içinde → yeni sinyal yerine mevcut
  sinyal güncellenir (seviye + açıklama), istemciye `200` + "Mevcut sinyalin güncellendi".
- **Koordineli manipülasyon:** Bir yerde 10 dk içinde, hesap yaşı < 3 gün olan ≥ 3 hesaptan aynı
  yönde sinyal → bu gözlemlerin ağırlığı ×0.2, moderasyon kuyruğuna işaret.
- **Hassas yerler** (`is_sensitive`): Sağlık, ibadet, eğitim, sığınma. Paylaşımda kamera ekranında uyarı
  (`11_SAFETY` §3); anonim sinyal varsayılan önerilir; sağlık yerlerinde `HealthNotice`.
